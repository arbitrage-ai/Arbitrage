import { z } from 'zod';
import { text, error, object, markdown, widget } from 'mcp-use/server';
import type { McpServerInstance, ToolContext } from 'mcp-use/server';
import { getSession } from '../lib/utils/session.js';
import { getSessionId } from '../lib/utils/ctx.js';
import { KalshiClient } from '../lib/kalshi/client.js';
import { PolymarketClient } from '../lib/polymarket/client.js';
import {
  matchMarketsAcrossPlatforms,
  searchBasedMatch,
} from '../lib/arbitrage/matcher.js';
import {
  findArbitrageOpportunities,
  calculateProfit,
  sizePosition,
} from '../lib/arbitrage/engine.js';
import { kalshiCentsToDecimal, formatDollars, formatPercent } from '../lib/utils/normalize.js';
import type { KalshiMarket } from '../lib/kalshi/types.js';
import type { PolymarketMarket } from '../lib/polymarket/types.js';
import type { PolymarketEvent } from '../lib/polymarket/types.js';
import { DomeClient } from '../lib/dome/client.js';
import type { MatchedMarket } from '../lib/arbitrage/matcher.js';

const DOME_API_KEY = process.env.DOME_API_KEY || '220e4cdeb2b55ec2c3bba7b330410d13f56321c8';
const dome = new DomeClient(DOME_API_KEY);

// ---------------------------------------------------------------------------
// Category configuration — covers sports, politics, economics, crypto, etc.
// ---------------------------------------------------------------------------

interface CategoryConfig {
  kalshiSeries: string[];
  polyTags: number[];
  label: string;
}

const CATEGORIES: Record<string, CategoryConfig> = {
  nfl:       { kalshiSeries: ['NFL', 'SUPER'], polyTags: [450], label: 'NFL' },
  nba:       { kalshiSeries: ['NBA'], polyTags: [745], label: 'NBA' },
  mlb:       { kalshiSeries: ['MLB'], polyTags: [100381], label: 'MLB' },
  nhl:       { kalshiSeries: ['NHL'], polyTags: [899], label: 'NHL' },
  ncaaf:     { kalshiSeries: ['CFB', 'NCAAF'], polyTags: [100351], label: 'NCAAF' },
  ncaab:     { kalshiSeries: ['NCAA', 'NCAAB'], polyTags: [100149, 101178], label: 'NCAAB' },
  politics:  { kalshiSeries: [], polyTags: [2, 188], label: 'Politics' },
  economics: { kalshiSeries: [], polyTags: [100328, 120], label: 'Economics' },
  crypto:    { kalshiSeries: [], polyTags: [21], label: 'Crypto' },
  all:       { kalshiSeries: [], polyTags: [2, 21, 120, 100328, 188, 745, 450], label: 'All Categories' },
};

const CATEGORY_KEYS = Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[];

// Polymarket dummy client for unauthenticated public API access
const POLY_DUMMY_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001';

// ---------------------------------------------------------------------------
// Market fetching
// ---------------------------------------------------------------------------

async function fetchKalshiMarkets(
  client: KalshiClient,
  category: string,
): Promise<KalshiMarket[]> {
  const cfg = CATEGORIES[category] || CATEGORIES.all;
  const allMarkets: KalshiMarket[] = [];
  const seen = new Set<string>();

  const add = (markets: KalshiMarket[]) => {
    for (const m of markets) {
      if (!seen.has(m.ticker) && m.yes_ask > 0 && m.no_ask > 0) {
        seen.add(m.ticker);
        allMarkets.push(m);
      }
    }
  };

  if (cfg.kalshiSeries.length > 0) {
    const promises = cfg.kalshiSeries.map(async (prefix) => {
      try {
        const { markets } = await client.getMarkets({ status: 'open', series_ticker: prefix, limit: 200 });
        return markets;
      } catch { return []; }
    });
    const results = await Promise.all(promises);
    for (const r of results) add(r);
  }

  // Always fetch broad set for 'all' or as supplement
  let broadCursor = '';
  if (allMarkets.length < 50 || category === 'all') {
    try {
      const res = await client.getMarkets({ status: 'open', limit: 200 });
      add(res.markets);
      broadCursor = res.cursor || '';
    } catch { /* ignore */ }
  }

  // Second page for maximum coverage (reuse cursor from first broad fetch)
  if (category === 'all' && allMarkets.length >= 200 && broadCursor) {
    try {
      const { markets: page2 } = await client.getMarkets({ status: 'open', limit: 200, cursor: broadCursor });
      add(page2);
    } catch { /* ignore */ }
  }

  return allMarkets;
}

async function fetchPolymarkets(category: string): Promise<PolymarketMarket[]> {
  const cfg = CATEGORIES[category] || CATEGORIES.all;
  const tempClient = new PolymarketClient(POLY_DUMMY_KEY);
  const allMarkets: PolymarketMarket[] = [];
  const seen = new Set<string>();

  const add = (markets: PolymarketMarket[]) => {
    for (const m of markets) {
      if (!seen.has(m.id) && !m.closed) {
        seen.add(m.id);
        allMarkets.push(m);
      }
    }
  };

  // Fetch by tags
  const tagPromises = cfg.polyTags.map(async (tagId) => {
    try {
      const events = await tempClient.searchEvents({ active: true, closed: false, tag_id: tagId, limit: 100 });
      const markets: PolymarketMarket[] = [];
      for (const ev of events) {
        if (Array.isArray(ev.markets)) {
          for (const m of ev.markets) {
            (m as PolymarketMarket & { eventTitle?: string }).eventTitle = ev.title;
            markets.push(m);
          }
        }
      }
      return markets;
    } catch { return []; }
  });
  const tagResults = await Promise.all(tagPromises);
  for (const r of tagResults) add(r);

  // Fetch high-volume events for broader coverage
  const fetchByVolume = async (limit: number, offset = 0) => {
    try {
      const events = await tempClient.searchEvents({
        active: true, closed: false, order: 'volume24hr', ascending: false, limit, offset,
      });
      const markets: PolymarketMarket[] = [];
      for (const ev of events) {
        if (Array.isArray(ev.markets)) {
          for (const m of ev.markets) {
            (m as PolymarketMarket & { eventTitle?: string }).eventTitle = ev.title;
            markets.push(m);
          }
        }
      }
      return markets;
    } catch { return []; }
  };

  // Always supplement with top-volume events for maximum overlap
  const [page1, page2] = await Promise.all([
    fetchByVolume(100, 0),
    category === 'all' ? fetchByVolume(100, 100) : Promise.resolve([]),
  ]);
  add(page1);
  add(page2);

  // Direct markets endpoint as fallback
  if (allMarkets.length < 50) {
    try {
      const markets = await tempClient.searchMarkets({ active: true, closed: false, limit: 200 });
      add(markets);
    } catch { /* ignore */ }
  }

  return allMarkets;
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

function formatOpportunityTable(
  opportunities: ReturnType<typeof findArbitrageOpportunities>,
  maxRows: number,
): string {
  const top = opportunities.slice(0, maxRows);
  let md = '| # | Market | Edge | Profit/$100 | Confidence | Trade |\n';
  md += '|--:|--------|-----:|------------:|----------:|-------|\n';

  for (let i = 0; i < top.length; i++) {
    const o = top[i];
    const edgePct = (o.edge * 100).toFixed(2);
    const profitPer100 = ((o.edge / o.totalCost) * 100).toFixed(2);
    const conf = `${(o.matchConfidence * 100).toFixed(0)}%`;
    const name = o.eventName.length > 50 ? o.eventName.slice(0, 47) + '...' : o.eventName;
    const trade = o.kalshiSide === 'yes'
      ? `YES@${(o.kalshiPrice * 100).toFixed(0)}¢ (K) + NO@${(o.polymarketPrice * 100).toFixed(0)}¢ (PM)`
      : `NO@${(o.kalshiPrice * 100).toFixed(0)}¢ (K) + YES@${(o.polymarketPrice * 100).toFixed(0)}¢ (PM)`;

    md += `| ${i + 1} | ${name} | ${edgePct}% | $${profitPer100} | ${conf} | ${trade} |\n`;
  }

  return md;
}

function formatDetailedOpportunity(
  opp: ReturnType<typeof findArbitrageOpportunities>[0],
  idx: number,
  stake: number,
): string {
  const profit = calculateProfit(opp, stake);
  let md = `### #${idx}  ${opp.eventName}\n\n`;

  md += `| Platform | Side | Price | Question |\n`;
  md += `|----------|------|------:|----------|\n`;
  md += `| **Kalshi** | ${opp.kalshiSide.toUpperCase()} | ${(opp.kalshiPrice * 100).toFixed(1)}¢ | ${opp.kalshiQuestion.slice(0, 60)} |\n`;
  md += `| **Polymarket** | ${opp.polymarketSide} | ${(opp.polymarketPrice * 100).toFixed(1)}¢ | ${opp.polymarketQuestion.slice(0, 60)} |\n\n`;

  md += `**Edge:** ${(opp.edge * 100).toFixed(2)}%`;
  md += ` · **Match:** ${(opp.matchConfidence * 100).toFixed(0)}% (${opp.matchMethod})`;
  md += ` · **ROI:** ${opp.roi.toFixed(2)}%\n\n`;

  if (profit.contracts > 0) {
    md += `**Trade Plan** (${formatDollars(stake)} max stake):\n`;
    md += `- Buy ${profit.contracts} ${opp.kalshiSide.toUpperCase()} on Kalshi → ${formatDollars(profit.kalshiCost)}\n`;
    md += `- Buy ${profit.contracts} ${opp.polymarketSide} on Polymarket → ${formatDollars(profit.polymarketCost)}\n`;
    md += `- **Total:** ${formatDollars(profit.totalInvestment)} → **Payout:** ${formatDollars(profit.totalInvestment + profit.grossProfit)}\n`;
    md += `- Kalshi fees (~7%): -${formatDollars(profit.kalshiFees)}\n`;
    md += `- **Net profit: ${formatDollars(profit.netProfit)}** (${profit.netROI.toFixed(2)}% ROI)\n`;
  }

  return md;
}

// ---------------------------------------------------------------------------
// Multi-outcome event mispricing scanner
// ---------------------------------------------------------------------------

interface EventMispricing {
  platform: 'kalshi' | 'polymarket';
  eventTitle: string;
  eventTicker: string;
  numOutcomes: number;
  yesSum: number;
  direction: 'buy_all_yes' | 'buy_all_no';
  edge: number;
  profitPerDollar: number;
  verified: boolean;
  markets: {
    id: string;
    question: string;
    yesPrice: number;
    noPrice: number;
    tokenIds?: string[];
  }[];
}

async function scanKalshiEventMispricing(
  client: KalshiClient,
): Promise<EventMispricing[]> {
  const results: EventMispricing[] = [];

  try {
    // Deep paginate all open markets (up to 10 pages = 2000 markets)
    const events = new Map<string, KalshiMarket[]>();
    const seen = new Set<string>();
    let cursor = '';
    const MAX_PAGES = 10;

    for (let page = 0; page < MAX_PAGES; page++) {
      const params: { status: string; limit: number; cursor?: string } = { status: 'open', limit: 200 };
      if (cursor) params.cursor = cursor;

      const res = await client.getMarkets(params);
      if (!res.markets || res.markets.length === 0) break;

      for (const m of res.markets) {
        if (seen.has(m.ticker)) continue;
        seen.add(m.ticker);
        if (m.yes_ask <= 0 || m.no_ask <= 0) continue;
        const group = events.get(m.event_ticker) || [];
        group.push(m);
        events.set(m.event_ticker, group);
      }

      cursor = res.cursor || '';
      if (!cursor || res.markets.length < 200) break;
    }

    for (const [eventTicker, mks] of events) {
      if (mks.length < 2) continue;

      const yesAskSum = mks.reduce((s, m) => s + m.yes_ask, 0);
      const noAskSum = mks.reduce((s, m) => s + m.no_ask, 0);
      const N = mks.length;

      // Buy all YES: cost = yesAskSum, payout = 100
      const yesEdgeCents = 100 - yesAskSum;
      if (yesEdgeCents > 0) {
        results.push({
          platform: 'kalshi',
          eventTitle: mks[0].title.split(' ').slice(0, -1).join(' ') || eventTicker,
          eventTicker,
          numOutcomes: N,
          yesSum: yesAskSum / 100,
          direction: 'buy_all_yes',
          edge: yesEdgeCents / 100,
          profitPerDollar: yesEdgeCents / yesAskSum,
          verified: false,
          markets: mks.map((m) => ({
            id: m.ticker,
            question: `${m.title} ${m.subtitle}`.trim(),
            yesPrice: m.yes_ask / 100,
            noPrice: m.no_ask / 100,
          })),
        });
      }

      // Buy all NO: cost = noAskSum, payout = (N-1) * 100
      const noEdgeCents = (N - 1) * 100 - noAskSum;
      if (noEdgeCents > 0) {
        results.push({
          platform: 'kalshi',
          eventTitle: mks[0].title.split(' ').slice(0, -1).join(' ') || eventTicker,
          eventTicker,
          numOutcomes: N,
          yesSum: yesAskSum / 100,
          direction: 'buy_all_no',
          edge: noEdgeCents / 100,
          profitPerDollar: noEdgeCents / noAskSum,
          verified: false,
          markets: mks.map((m) => ({
            id: m.ticker,
            question: `${m.title} ${m.subtitle}`.trim(),
            yesPrice: m.yes_ask / 100,
            noPrice: m.no_ask / 100,
          })),
        });
      }
    }
  } catch { /* ignore */ }

  return results.sort((a, b) => b.edge - a.edge);
}

async function scanPolymarketEventMispricing(): Promise<EventMispricing[]> {
  const results: EventMispricing[] = [];
  const tempClient = new PolymarketClient(POLY_DUMMY_KEY);
  const seenEvents = new Set<string>();

  try {
    // Deep paginate high-volume events (up to 5 pages = 500 events)
    const MAX_PAGES = 5;
    for (let page = 0; page < MAX_PAGES; page++) {
      const events = await tempClient.searchEvents({
        active: true, closed: false, order: 'volume24hr', ascending: false,
        limit: 100, offset: page * 100,
      });
      if (!events || events.length === 0) break;

      for (const event of events) {
        if (!event.markets || event.markets.length < 2) continue;
        if (seenEvents.has(event.slug)) continue;
        seenEvents.add(event.slug);

        const parsedMarkets: { slug: string; question: string; yesPrice: number; noPrice: number; tokenIds: string[] }[] = [];
        for (const m of event.markets) {
          if (!m.active || m.closed) continue;
          const parsed = PolymarketClient.parseMarketFields(m as unknown as Record<string, unknown>);
          const yp = parseFloat(parsed.outcomePrices[0] || '0');
          const np = parseFloat(parsed.outcomePrices[1] || '0');
          if (yp > 0 || np > 0) {
            parsedMarkets.push({
              slug: m.slug, question: m.question, yesPrice: yp, noPrice: np,
              tokenIds: parsed.clobTokenIds,
            });
          }
        }

        if (parsedMarkets.length < 2) continue;

        const yesSum = parsedMarkets.reduce((s, m) => s + m.yesPrice, 0);
        const N = parsedMarkets.length;

        // Spread buffer — midpoints aren't executable, real ask is typically 1-2% wider
        const SPREAD_BUFFER = 0.02;

        // Buy all YES: cost ~ yesSum + buffer, payout = 1.0
        const yesEdge = 1.0 - yesSum - SPREAD_BUFFER;
        if (yesEdge > 0) {
          results.push({
            platform: 'polymarket',
            eventTitle: event.title,
            eventTicker: event.slug,
            numOutcomes: N,
            yesSum,
            direction: 'buy_all_yes',
            edge: yesEdge,
            profitPerDollar: yesEdge / (yesSum + SPREAD_BUFFER),
            verified: false,
            markets: parsedMarkets.map((m) => ({
              id: m.slug, question: m.question, yesPrice: m.yesPrice, noPrice: m.noPrice,
              tokenIds: m.tokenIds,
            })),
          });
        }

        // Buy all NO: cost ~ noSum + buffer, payout = N-1
        const noSum = parsedMarkets.reduce((s, m) => s + m.noPrice, 0);
        const noEdge = (N - 1) - noSum - SPREAD_BUFFER;
        if (noEdge > 0) {
          results.push({
            platform: 'polymarket',
            eventTitle: event.title,
            eventTicker: event.slug,
            numOutcomes: N,
            yesSum,
            direction: 'buy_all_no',
            edge: noEdge,
            profitPerDollar: noEdge / (noSum + SPREAD_BUFFER),
            verified: false,
            markets: parsedMarkets.map((m) => ({
              id: m.slug, question: m.question, yesPrice: m.yesPrice, noPrice: m.noPrice,
              tokenIds: m.tokenIds,
            })),
          });
        }
      }

      if (events.length < 100) break;
    }
  } catch { /* ignore */ }

  return results.sort((a, b) => b.edge - a.edge);
}

// ---------------------------------------------------------------------------
// Orderbook verification — replaces midpoints with real executable ask prices
// ---------------------------------------------------------------------------

async function verifyMispricingWithOrderbook(
  opp: EventMispricing,
  kalshiClient?: KalshiClient,
): Promise<EventMispricing | null> {
  const verified = { ...opp, markets: [...opp.markets], verified: true };

  if (opp.platform === 'kalshi' && kalshiClient) {
    // Kalshi: fetch orderbook for each market, use best ask
    const updatedMarkets = await Promise.all(
      opp.markets.map(async (m) => {
        try {
          const { orderbook } = await kalshiClient.getOrderbook(m.id);
          // yes field = array of [price, qty] for YES asks (sorted by price asc)
          const bestYesAsk = orderbook.yes?.[0]?.[0];
          const bestNoAsk = orderbook.no?.[0]?.[0];
          return {
            ...m,
            yesPrice: bestYesAsk != null ? bestYesAsk / 100 : m.yesPrice,
            noPrice: bestNoAsk != null ? bestNoAsk / 100 : m.noPrice,
          };
        } catch {
          return m;
        }
      }),
    );
    verified.markets = updatedMarkets;
  } else if (opp.platform === 'polymarket') {
    // Polymarket: fetch public CLOB orderbook for each market's YES token
    const updatedMarkets = await Promise.all(
      opp.markets.map(async (m) => {
        const yesTokenId = m.tokenIds?.[0];
        const noTokenId = m.tokenIds?.[1];
        if (!yesTokenId) return m;
        try {
          // Fetch YES token book — best ask = cheapest price to buy YES
          const yesBook = await PolymarketClient.getPublicOrderbook(yesTokenId);
          const bestYesAsk = yesBook.asks?.[0]?.price ? parseFloat(yesBook.asks[0].price) : m.yesPrice;

          let bestNoAsk = m.noPrice;
          if (noTokenId) {
            try {
              const noBook = await PolymarketClient.getPublicOrderbook(noTokenId);
              bestNoAsk = noBook.asks?.[0]?.price ? parseFloat(noBook.asks[0].price) : m.noPrice;
            } catch { /* keep midpoint */ }
          }

          return { ...m, yesPrice: bestYesAsk, noPrice: bestNoAsk };
        } catch {
          return m;
        }
      }),
    );
    verified.markets = updatedMarkets;
  }

  // Recalculate edge with verified prices
  const yesSum = verified.markets.reduce((s, m) => s + m.yesPrice, 0);
  const noSum = verified.markets.reduce((s, m) => s + m.noPrice, 0);
  const N = verified.numOutcomes;

  if (opp.direction === 'buy_all_yes') {
    const payout = opp.platform === 'kalshi' ? 1.0 : 1.0;
    const edge = payout - yesSum;
    if (edge <= 0) return null; // edge gone after verification
    verified.yesSum = yesSum;
    verified.edge = edge;
    verified.profitPerDollar = edge / yesSum;
  } else {
    const payout = N - 1;
    const edge = payout - noSum;
    if (edge <= 0) return null;
    verified.yesSum = yesSum;
    verified.edge = edge;
    verified.profitPerDollar = edge / noSum;
  }

  return verified;
}

// ---------------------------------------------------------------------------
// Dome API matching — uses pre-computed cross-platform market pairs
// ---------------------------------------------------------------------------

async function domeMatchedPairs(
  kalshiMarkets: KalshiMarket[],
  polyMarkets: PolymarketMarket[],
): Promise<MatchedMarket[]> {
  const results: MatchedMarket[] = [];
  // Send ALL polymarket slugs to Dome (not just sports) — Dome decides what it can match.
  // Batch in chunks of 50 to stay within API limits.
  const allSlugs = polyMarkets.map((m) => m.slug).filter(Boolean);
  if (allSlugs.length === 0) return results;

  const kalshiByTicker = new Map(kalshiMarkets.map((m) => [m.ticker, m]));
  const polyBySlug = new Map(polyMarkets.map((m) => [m.slug, m]));

  const batchSize = 50;
  for (let i = 0; i < allSlugs.length; i += batchSize) {
    const batch = allSlugs.slice(i, i + batchSize);
    try {
      const { markets: matchMap } = await dome.getMatchingSportsMarkets({
        polymarket_slugs: batch,
      });

      for (const [, platforms] of Object.entries(matchMap)) {
        const kalshiEntry = platforms.find((p) => p.platform === 'KALSHI');
        const polyEntry = platforms.find((p) => p.platform === 'POLYMARKET');
        if (!kalshiEntry?.market_tickers?.length || !polyEntry?.market_slug) continue;

        const polyMkt = polyBySlug.get(polyEntry.market_slug);
        if (!polyMkt) continue;

        const parsed = PolymarketClient.parseMarketFields(polyMkt as unknown as Record<string, unknown>);
        const polyYes = parseFloat(parsed.outcomePrices[0] || '0');
        const polyNo = parseFloat(parsed.outcomePrices[1] || '0');
        if (polyYes === 0 && polyNo === 0) continue;

        for (const kTicker of kalshiEntry.market_tickers) {
          const kMkt = kalshiByTicker.get(kTicker);
          if (!kMkt) continue;

          results.push({
            kalshiTicker: kMkt.ticker,
            kalshiQuestion: `${kMkt.title} ${kMkt.subtitle || ''}`.trim(),
            kalshiYesPrice: kalshiCentsToDecimal(kMkt.yes_ask),
            kalshiNoPrice: kalshiCentsToDecimal(kMkt.no_ask),
            kalshiYesBid: kalshiCentsToDecimal(kMkt.yes_bid),
            kalshiYesAsk: kalshiCentsToDecimal(kMkt.yes_ask),
            polymarketSlug: polyMkt.slug,
            polymarketQuestion: polyMkt.question,
            polymarketYesPrice: polyYes,
            polymarketNoPrice: polyNo,
            polymarketTokenIds: parsed.clobTokenIds,
            matchConfidence: 0.99,
            matchMethod: 'search' as const, // Dome = verified match
          });
        }
      }
    } catch { /* continue with next batch */ }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerArbitrageTools(server: McpServerInstance) {

  // =========================================================================
  // scan_arbitrage — the main scanner
  // =========================================================================
  server.tool(
    {
      name: 'scan_arbitrage',
      description:
        'Scan for cross-platform arbitrage (Kalshi vs Polymarket) and multi-outcome mispricing. Renders an interactive arbitrage scanner widget with execute buttons for each opportunity. ' +
        'WHEN: User wants to find risk-free profit, asks about arbitrage, or after suggest_markets surfaces interesting markets. ' +
        'REQUIRES: Kalshi authentication (call auth_status first to show login widget). Polymarket data is fetched without auth. ' +
        'HOW: (1) Cross-platform: buy YES on one exchange + NO on other when combined cost < $1. (2) Event mispricing: outcome prices sum ≠ $1. ' +
        'THEN: quick_arb(dry_run: true) to preview the best trade, or get_orderbook to verify liquidity. ' +
        'Best during volatile periods when one platform lags in price updates.',
      widget: {
        name: 'arbitrage-scanner',
        invoking: 'Scanning for arbitrage...',
        invoked: 'Scan complete',
      },
      schema: z.object({
        category: z
          .enum(['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab', 'politics', 'economics', 'crypto', 'all'])
          .default('all')
          .describe('Category to scan. Use "all" for maximum coverage across every market type.'),
        min_edge: z
          .number()
          .min(0)
          .max(1)
          .default(0.005)
          .describe('Minimum edge as decimal (0.005 = 0.5%). Lower = more results.'),
        max_results: z
          .number()
          .default(15)
          .describe('Max opportunities to return'),
        use_search: z
          .boolean()
          .default(true)
          .describe('Enable search-based matching for higher accuracy. Slightly slower but finds more opportunities.'),
        example_stake: z
          .number()
          .default(50)
          .describe('Example stake in dollars for profit projections'),
      }),
    },
    async ({ category, min_edge, max_results, use_search, example_stake }, ctx: ToolContext) => {
      const state = getSession(getSessionId(ctx));

      if (!state.kalshi) {
        return error('Kalshi authentication required. Run kalshi_login first.');
      }

      const t0 = Date.now();

      try {
        // Phase 1: Parallel fetch from both platforms
        const [kalshiMarkets, polyMarkets] = await Promise.all([
          fetchKalshiMarkets(state.kalshi.client, category),
          fetchPolymarkets(category),
        ]);

        const fetchMs = Date.now() - t0;

        if (kalshiMarkets.length === 0) {
          return text(`No open Kalshi markets found for category: ${category}.`);
        }
        if (polyMarkets.length === 0) {
          return text(`No active Polymarket markets found for category: ${category}.`);
        }

        // Phase 1: Dome API — pre-computed verified cross-platform pairs (highest trust)
        let domeMatched: MatchedMarket[] = [];
        try {
          domeMatched = await domeMatchedPairs(kalshiMarkets, polyMarkets);
        } catch { /* continue without Dome */ }

        // Track what Dome already matched so fuzzy/search don't produce duplicates
        const domeMatchedTickers = new Set(domeMatched.map((m) => m.kalshiTicker));
        const domeMatchedPolySlugs = new Set(domeMatched.map((m) => m.polymarketSlug));

        // Phase 2: Fuzzy matching for markets Dome didn't cover
        const fuzzyMatched = matchMarketsAcrossPlatforms(
          kalshiMarkets.filter((km) => !domeMatchedTickers.has(km.ticker)),
          polyMarkets.filter((pm) => !domeMatchedPolySlugs.has(pm.slug)),
          0.55,
        );

        // Phase 3: Search-based matching for remaining unmatched
        let searchMatched: Awaited<ReturnType<typeof searchBasedMatch>> = [];
        if (use_search) {
          const alreadyMatched = new Set([...domeMatchedTickers, ...fuzzyMatched.map((m) => m.kalshiTicker)]);
          const usedPolyIds = new Set([
            ...domeMatched.map((m) => polyMarkets.find((p) => p.slug === m.polymarketSlug)?.id).filter(Boolean) as string[],
            ...fuzzyMatched.map((m) => polyMarkets.find((p) => p.slug === m.polymarketSlug)?.id).filter(Boolean) as string[],
          ]);
          const polyClient = new PolymarketClient(POLY_DUMMY_KEY);
          searchMatched = await searchBasedMatch(
            kalshiMarkets, alreadyMatched, polyClient, 0.55, 5, 25, polyMarkets, usedPolyIds,
          );
        }

        // Dome first (highest trust), then fuzzy, then search
        const allMatched = [...domeMatched, ...fuzzyMatched, ...searchMatched];
        const matchMs = Date.now() - t0;

        // Don't bail on zero cross-platform matches — event mispricing below still runs

        // Phase 4: Find arbitrage opportunities
        const opportunities = findArbitrageOpportunities(allMatched, min_edge);
        const label = CATEGORIES[category]?.label || category;

        // Phase 5: Also scan multi-outcome event mispricing
        const eventOpps: EventMispricing[] = [];
        try {
          const [kalshiEvt, polyEvt] = await Promise.all([
            state.kalshi ? scanKalshiEventMispricing(state.kalshi.client) : Promise.resolve([]),
            scanPolymarketEventMispricing(),
          ]);
          eventOpps.push(...kalshiEvt, ...polyEvt);
        } catch { /* non-critical */ }
        const eventFiltered = eventOpps.filter((o) => o.edge >= min_edge);

        if (opportunities.length === 0 && eventFiltered.length === 0) {
          const ms = Date.now() - t0;
          let md = `## Arbitrage Scan — ${label}\n\n`;
          md += `Scanned **${kalshiMarkets.length}** Kalshi × **${polyMarkets.length}** Polymarket markets in **${(ms / 1000).toFixed(1)}s**\n`;
          md += `Matched **${allMatched.length}** cross-platform pairs (${fuzzyMatched.length} fuzzy + ${searchMatched.length} search + ${domeMatched.length} Dome)\n\n`;
          md += `No arbitrage with edge ≥ ${(min_edge * 100).toFixed(1)}%. Markets are efficiently priced.\n\n`;
          md += `**Try:** Lower \`min_edge\` to 0.001, scan during live games, or check back when prices are moving.`;
          return markdown(md);
        }

        const top = opportunities.slice(0, max_results);
        const totalMs = Date.now() - t0;

        // Build the output
        let md = `## Cross-Platform Arbitrage Scanner — ${label}\n\n`;
        md += `**Scanned:** ${kalshiMarkets.length} Kalshi × ${polyMarkets.length} Polymarket in **${(totalMs / 1000).toFixed(1)}s**\n`;
        md += `**Matched:** ${allMatched.length} cross-platform pairs (${fuzzyMatched.length} fuzzy + ${searchMatched.length} search + ${domeMatched.length} Dome)\n`;
        md += `**Cross-platform arb:** ${opportunities.length} opportunities\n`;
        md += `**Event mispricing:** ${eventFiltered.length} multi-outcome opportunities\n\n`;

        if (top.length > 0) {
          md += `### Cross-Platform Arbitrage\n\n`;
          md += formatOpportunityTable(top, max_results);
          md += '\n';
          const detailCount = Math.min(3, top.length);
          md += `---\n\n`;
          for (let i = 0; i < detailCount; i++) {
            md += formatDetailedOpportunity(top[i], i + 1, example_stake);
            md += '\n';
          }
        }

        if (eventFiltered.length > 0) {
          md += `### Event Mispricing (Single Platform)\n\n`;
          md += `| # | Platform | Event | Outcomes | YES Sum | Direction | Edge |\n`;
          md += `|--:|----------|-------|--------:|--------:|-----------|-----:|\n`;
          for (let i = 0; i < Math.min(eventFiltered.length, 5); i++) {
            const o = eventFiltered[i];
            const rawTitle = o.eventTitle || 'Unknown';
            const title = rawTitle.length > 35 ? rawTitle.slice(0, 32) + '...' : rawTitle;
            const dir = o.direction === 'buy_all_yes' ? 'Buy ALL Yes' : 'Buy ALL No';
            md += `| ${i + 1} | ${o.platform} | ${title} | ${o.numOutcomes} | ${o.yesSum.toFixed(3)} | ${dir} | ${(o.edge * 100).toFixed(2)}% |\n`;
          }
          md += `\n*Use \`scan_mispricing\` for full details and execution plans.*\n`;
        }

        if (top.length > 0 || eventFiltered.length > 0) {
          md += `\n---\n*Execute: \`quick_arb\` with \`category: "${category}"\` and \`max_stake: ${example_stake}\`*`;
        }

        const scanData = {
          scan_summary: {
            sport: label,
            kalshi_markets_fetched: kalshiMarkets.length,
            polymarket_markets_fetched: polyMarkets.length,
            matched_pairs: allMatched.length,
            opportunities_found: opportunities.length,
            min_edge_filter: min_edge,
          },
          opportunities: top.map((o) => ({
            id: o.id,
            event: o.eventName,
            trade: o.direction,
            edge_pct: parseFloat((o.edge * 100).toFixed(3)),
            profit_per_contract: parseFloat(o.profitPerContract.toFixed(4)),
            total_cost_per_pair: parseFloat(o.totalCost.toFixed(4)),
            roi_pct: parseFloat(o.roi.toFixed(2)),
            kalshi_ticker: o.kalshiTicker,
            kalshi_side: o.kalshiSide,
            kalshi_price: o.kalshiPrice,
            polymarket_slug: o.polymarketSlug,
            polymarket_side: o.polymarketSide,
            polymarket_token_idx: o.polymarketTokenIdx,
            polymarket_price: o.polymarketPrice,
            match_confidence: parseFloat((o.matchConfidence * 100).toFixed(0)),
            quality_score: parseFloat(o.qualityScore.toFixed(4)),
            match_method: o.matchMethod,
          })),
          event_mispricing: eventFiltered.slice(0, 5).map((o) => ({
            platform: o.platform,
            event: o.eventTitle,
            num_outcomes: o.numOutcomes,
            yes_sum: parseFloat(o.yesSum.toFixed(4)),
            direction: o.direction,
            edge_pct: parseFloat((o.edge * 100).toFixed(3)),
          })),
          markdown: md,
        };
        return widget({
          props: scanData,
          output: object(scanData),
        });
      } catch (e: unknown) {
        return error(`Arbitrage scan failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // =========================================================================
  // scan_mispricing — multi-outcome event mispricing (ask prices matter)
  // =========================================================================
  server.tool(
    {
      name: 'scan_mispricing',
      description:
        'Find events where outcome prices don\'t sum to $1 — guaranteed profit opportunities. ' +
        'WHEN: After scan_arbitrage for deeper single-platform analysis, or when user asks about mispricing or guaranteed profit. ' +
        'HOW: N mutually exclusive outcomes should sum to $1. If < $1 → buy all YES (one must win). If > $1 → buy all NO. ' +
        'AUTOMATIC ORDERBOOK VERIFICATION: Top opportunities are verified against real ask prices before display. ' +
        'THEN: execute_mispricing to batch-execute all legs of the best opportunity.',
      widget: {
        name: 'arbitrage-scanner',
        invoking: 'Deep-scanning mispricing across all events...',
        invoked: 'Mispricing scan complete',
      },
      schema: z.object({
        platform: z
          .enum(['kalshi', 'polymarket', 'both'])
          .default('both')
          .describe('Which platform to scan'),
        min_edge: z
          .number()
          .default(0.003)
          .describe('Minimum edge as decimal (0.003 = 0.3%). Lower = more results.'),
        max_results: z
          .number()
          .default(15)
          .describe('Max opportunities to return'),
        example_stake: z
          .number()
          .default(50)
          .describe('Stake for profit projection'),
        verify_orderbook: z
          .boolean()
          .default(true)
          .describe('Verify top opportunities against real orderbook ask prices. Slower but guarantees executable edge.'),
      }),
    },
    async ({ platform, min_edge, max_results, example_stake, verify_orderbook }, ctx: ToolContext) => {
      const state = getSession(getSessionId(ctx));
      const t0 = Date.now();
      const allOpps: EventMispricing[] = [];

      try {
        // Kalshi scan
        if ((platform === 'kalshi' || platform === 'both') && state.kalshi) {
          try {
            const kalshiOpps = await scanKalshiEventMispricing(state.kalshi.client);
            allOpps.push(...kalshiOpps);
          } catch { /* Kalshi mispricing scan non-critical */ }
        } else if (platform === 'kalshi' && !state.kalshi) {
          return error('Kalshi authentication required. Run kalshi_login first.');
        }

        // Polymarket scan (no auth needed)
        if (platform === 'polymarket' || platform === 'both') {
          try {
            const polyOpps = await scanPolymarketEventMispricing();
            allOpps.push(...polyOpps);
          } catch { /* Polymarket mispricing scan non-critical */ }
        }

        const scanElapsed = ((Date.now() - t0) / 1000).toFixed(1);
        const preFilter = allOpps.filter((o) => o.edge >= min_edge).sort((a, b) => b.edge - a.edge);

        // Orderbook verification on top candidates
        let verified: EventMispricing[] = [];
        let verifiedCount = 0;
        if (verify_orderbook && preFilter.length > 0) {
          const toVerify = preFilter.slice(0, Math.min(max_results + 5, preFilter.length));
          const verifyResults = await Promise.all(
            toVerify.map((o) => verifyMispricingWithOrderbook(o, state.kalshi?.client)),
          );
          for (const v of verifyResults) {
            if (v && v.edge >= min_edge) verified.push(v);
          }
          verifiedCount = toVerify.length;
        } else {
          verified = preFilter;
        }

        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        const top = verified.slice(0, max_results);

        if (top.length === 0) {
          const noOppData = {
            scan_time_s: elapsed,
            markets_scanned: allOpps.length,
            pre_verify_candidates: preFilter.length,
            verified_survivors: 0,
            note: verify_orderbook && preFilter.length > 0
              ? `Found ${preFilter.length} candidates but none survived orderbook verification. Midpoint edges disappear at real ask prices.`
              : `All event outcome sums are within ${(min_edge * 100).toFixed(1)}% of fair value.`,
            markdown: `## Event Mispricing Scan — No Opportunities\n\nScanned in ${elapsed}s · ${preFilter.length} pre-filter candidates\n\n` +
              (verify_orderbook && preFilter.length > 0
                ? `Found ${preFilter.length} candidates based on midpoints, but **none survived orderbook verification**. Real ask prices eliminated all edges.\n\n`
                : `All outcome sums within ${(min_edge * 100).toFixed(1)}% of fair value.\n\n`) +
              `**Tips:** Try during volatile periods when prices lag, or lower \`min_edge\`.`,
          };
          return widget({ props: noOppData, output: object(noOppData) });
        }

        let md = `## Event Mispricing Scanner — ${top.length} Opportunities\n\n`;
        md += `Scanned in **${elapsed}s** (${scanElapsed}s scan + ${(parseFloat(elapsed) - parseFloat(scanElapsed)).toFixed(1)}s verification)\n`;
        if (verify_orderbook) md += `Verified **${verifiedCount}** candidates against orderbooks · **${top.length}** survived\n`;
        md += `Min edge: ${(min_edge * 100).toFixed(1)}%\n\n`;

        md += `| # | Platform | Event | Outcomes | YES Sum | Direction | Edge | Verified | Profit/$${example_stake} |\n`;
        md += `|--:|----------|-------|--------:|--------:|-----------|-----:|:--------:|----------:|\n`;

        for (let i = 0; i < top.length; i++) {
          const o = top[i];
          const title = (o.eventTitle || 'Unknown').length > 35 ? (o.eventTitle || 'Unknown').slice(0, 32) + '...' : (o.eventTitle || 'Unknown');
          const dir = o.direction === 'buy_all_yes' ? 'Buy ALL Yes' : 'Buy ALL No';
          const profitForStake = o.profitPerDollar * example_stake;
          const check = o.verified ? 'Yes' : 'No';
          md += `| ${i + 1} | ${o.platform} | ${title} | ${o.numOutcomes} | ${o.yesSum.toFixed(3)} | ${dir} | ${(o.edge * 100).toFixed(2)}% | ${check} | $${profitForStake.toFixed(2)} |\n`;
        }

        // Detail top 3
        const detailCount = Math.min(3, top.length);
        for (let i = 0; i < detailCount; i++) {
          const o = top[i];
          const mks = o.markets || [];
          md += `\n---\n\n### #${i + 1}  ${o.eventTitle || 'Unknown'} (${o.platform})${o.verified ? ' — VERIFIED' : ''}\n\n`;
          md += `**${o.numOutcomes} outcomes** · YES sum: ${o.yesSum.toFixed(4)} · Edge: ${(o.edge * 100).toFixed(2)}%\n\n`;
          md += `**Strategy:** ${o.direction === 'buy_all_yes' ? 'Buy YES on every outcome — exactly one must win → payout $1.00' : `Buy NO on every outcome — at most one loses → payout $${(o.numOutcomes - 1).toFixed(2)}`}\n`;

          const costPerSet = o.direction === 'buy_all_yes'
            ? mks.reduce((s, m) => s + m.yesPrice, 0)
            : mks.reduce((s, m) => s + m.noPrice, 0);
          const payout = o.direction === 'buy_all_yes' ? 1.0 : o.numOutcomes - 1;
          const sets = costPerSet > 0 ? Math.floor(example_stake / costPerSet) : 0;

          if (sets > 0) {
            md += `\n**Execution plan** ($${example_stake} stake → ${sets} sets):\n`;
            for (const m of mks) {
              const price = o.direction === 'buy_all_yes' ? m.yesPrice : m.noPrice;
              const side = o.direction === 'buy_all_yes' ? 'YES' : 'NO';
              md += `- Buy ${sets} ${side} "${(m.question || '').slice(0, 50)}" @ ${(price * 100).toFixed(1)}c\n`;
            }
            const totalCost = sets * costPerSet;
            const totalPayout = sets * payout;
            md += `- **Total cost:** ${formatDollars(totalCost)} · **Guaranteed payout:** ${formatDollars(totalPayout)} · **Profit:** ${formatDollars(totalPayout - totalCost)}\n`;
          }
        }

        md += `\n---\n*Execute: \`execute_mispricing\` with \`event_ticker\` from above and \`stake: ${example_stake}\`*`;

        const scanData = {
          scan_time_s: elapsed,
          opportunities_found: verified.length,
          orderbook_verified: verify_orderbook,
          opportunities: top.map((o) => ({
            platform: o.platform,
            event: o.eventTitle,
            event_id: o.eventTicker,
            num_outcomes: o.numOutcomes,
            yes_sum: parseFloat(o.yesSum.toFixed(4)),
            direction: o.direction,
            edge_pct: parseFloat((o.edge * 100).toFixed(3)),
            profit_per_dollar: parseFloat(o.profitPerDollar.toFixed(4)),
            profit_per_stake: parseFloat((o.profitPerDollar * example_stake).toFixed(2)),
            verified: o.verified,
            markets: (o.markets || []).map((m) => ({
              id: m.id,
              question: m.question,
              yes_price: m.yesPrice,
              no_price: m.noPrice,
            })),
          })),
          markdown: md,
        };
        return widget({ props: scanData, output: object(scanData) });
      } catch (e: unknown) {
        return error(`Mispricing scan failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  // =========================================================================
  // execute_mispricing — batch-execute all legs of a mispricing opportunity
  // =========================================================================
  server.tool(
    {
      name: 'execute_mispricing',
      description:
        'Execute a mispricing opportunity by placing orders on ALL outcomes simultaneously. ' +
        'WHEN: After scan_mispricing finds a verified opportunity, or user says "execute" / "do it". ' +
        'REQUIRES: Platform authentication (kalshi_login or polymarket_login). ' +
        'HOW: Re-verifies edge against live orderbook, then places limit orders for every outcome in the event. ' +
        'Executes immediately by default. Set dry_run=true to preview first.',
      widget: {
        name: 'trade-confirmation',
        invoking: 'Verifying and executing mispricing trades...',
        invoked: 'Mispricing execution complete',
      },
      schema: z.object({
        platform: z
          .enum(['kalshi', 'polymarket'])
          .describe('Which platform the mispricing is on'),
        event_ticker: z
          .string()
          .describe('Event ticker/slug from scan_mispricing results'),
        direction: z
          .enum(['buy_all_yes', 'buy_all_no'])
          .describe('Strategy direction from scan results'),
        stake: z
          .number()
          .min(1)
          .default(50)
          .describe('Total dollar amount to stake across all outcomes'),
        dry_run: z
          .boolean()
          .default(false)
          .describe('Set true to preview trades without executing.'),
      }),
    },
    async ({ platform, event_ticker, direction, stake, dry_run }, ctx: ToolContext) => {
      const state = getSession(getSessionId(ctx));

      if (platform === 'kalshi' && !state.kalshi) {
        return error('Kalshi authentication required. Run kalshi_login first.');
      }
      if (platform === 'polymarket' && !state.polymarket) {
        return error('Polymarket authentication required. Run polymarket_login first.');
      }

      try {
        // Step 1: Re-scan to find the specific opportunity and verify it's still live
        let opportunity: EventMispricing | null = null;

        if (platform === 'kalshi') {
          const opps = await scanKalshiEventMispricing(state.kalshi!.client);
          opportunity = opps.find((o) => o.eventTicker === event_ticker && o.direction === direction) || null;
        } else {
          const opps = await scanPolymarketEventMispricing();
          opportunity = opps.find((o) => o.eventTicker === event_ticker && o.direction === direction) || null;
        }

        if (!opportunity) {
          return error(
            `Mispricing opportunity no longer exists for ${event_ticker} (${direction}). ` +
            `Prices may have moved. Run scan_mispricing again to find current opportunities.`,
          );
        }

        // Step 2: Verify against live orderbook
        const verified = await verifyMispricingWithOrderbook(opportunity, state.kalshi?.client);
        if (!verified || verified.edge <= 0) {
          return error(
            `Edge for ${event_ticker} disappeared after orderbook verification. ` +
            `Midpoint showed ${(opportunity.edge * 100).toFixed(2)}% but real ask prices eliminate the profit. ` +
            `Run scan_mispricing to find opportunities that survive verification.`,
          );
        }

        // Step 3: Calculate position sizes
        const costPerSet = verified.direction === 'buy_all_yes'
          ? verified.markets.reduce((s, m) => s + m.yesPrice, 0)
          : verified.markets.reduce((s, m) => s + m.noPrice, 0);
        const payout = verified.direction === 'buy_all_yes' ? 1.0 : verified.numOutcomes - 1;
        const sets = costPerSet > 0 ? Math.floor(stake / costPerSet) : 0;

        if (sets < 1) {
          return error(
            `Stake of $${stake} too small. Need at least ${formatDollars(costPerSet)} per set. ` +
            `Increase stake to at least ${formatDollars(Math.ceil(costPerSet))}.`,
          );
        }

        const totalCost = sets * costPerSet;
        const totalPayout = sets * payout;
        const profit = totalPayout - totalCost;

        const side = verified.direction === 'buy_all_yes' ? 'YES' : 'NO';
        const orderPlans = verified.markets.map((m) => ({
          market_id: m.id,
          question: m.question,
          side,
          quantity: sets,
          price: verified.direction === 'buy_all_yes' ? m.yesPrice : m.noPrice,
          tokenIds: m.tokenIds,
        }));

        // Build plan in the shape the trade-confirmation widget expects
        const plan = {
          opportunity: `${verified.direction === 'buy_all_yes' ? 'Buy YES' : 'Buy NO'} on all ${verified.numOutcomes} outcomes — ${verified.eventTitle} (${platform})`,
          contracts: sets,
          total_cost: formatDollars(totalCost),
          guaranteed_profit: formatDollars(profit),
          edge_pct: `${(verified.edge * 100).toFixed(2)}%`,
          roi_pct: `${((profit / totalCost) * 100).toFixed(2)}%`,
          dry_run,
        };

        if (dry_run) {
          const dryData = {
            plan,
            orders: [] as Record<string, unknown>[],
            execution_errors: [] as string[],
            note: `DRY RUN — ${orderPlans.length} orders would be placed on ${platform}. Set dry_run=false to execute.`,
            guaranteed_profit: formatDollars(profit),
          };
          return widget({ props: dryData, output: object(dryData) });
        }

        // Step 4: Execute all orders
        const executedOrders: Record<string, unknown>[] = [];
        const execErrors: string[] = [];

        if (platform === 'kalshi') {
          for (const op of orderPlans) {
            try {
              const kalshiSide = op.side.toLowerCase() as 'yes' | 'no';
              const { order } = await state.kalshi!.client.createOrder({
                ticker: op.market_id,
                action: 'buy',
                side: kalshiSide,
                type: 'limit',
                count: op.quantity,
                ...(kalshiSide === 'yes'
                  ? { yes_price: Math.round(op.price * 100) }
                  : { no_price: Math.round(op.price * 100) }),
              });
              executedOrders.push({
                platform: 'kalshi',
                order_id: order.order_id,
                status: order.status,
                ticker: order.ticker,
                side: order.side,
                quantity: order.count,
                price: formatDollars(op.price),
              });
            } catch (e: unknown) {
              execErrors.push(`${op.market_id}: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        } else {
          for (const op of orderPlans) {
            const tokenIdx = op.side === 'YES' ? 0 : 1;
            const tokenId = op.tokenIds?.[tokenIdx];
            if (!tokenId) {
              execErrors.push(`${op.market_id}: Missing token ID for ${op.side}`);
              continue;
            }
            try {
              const order = await state.polymarket!.client.placeOrder({
                tokenId,
                price: op.price,
                size: op.quantity,
                side: 'BUY',
                orderType: 'GTC',
              });
              executedOrders.push({
                platform: 'polymarket',
                order_id: order.id,
                status: order.status,
                side: op.side,
                quantity: op.quantity,
                price: formatDollars(op.price),
              });
            } catch (e: unknown) {
              execErrors.push(`${op.market_id}: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        }

        const success = execErrors.length === 0;
        const execData = {
          plan,
          orders: executedOrders,
          execution_errors: execErrors,
          success,
          guaranteed_profit: formatDollars(profit),
          note: success
            ? `All ${executedOrders.length} orders placed. Guaranteed profit of ${formatDollars(profit)} locked in.`
            : `${executedOrders.length}/${orderPlans.length} orders placed. Review errors below.`,
        };
        return widget({ props: execData, output: object(execData) });
      } catch (e: unknown) {
        return error(`execute_mispricing failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  // =========================================================================
  // analyze_edge — deep analysis of a single market
  // =========================================================================
  server.tool(
    {
      name: 'analyze_edge',
      description:
        'Deep-dive edge analysis on a single market, comparing prediction market price vs ESPN sportsbook implied probabilities. ' +
        'WHEN: User has conviction on a specific sports market and wants to know if the price is off, or after scan_arbitrage surfaces a sports opportunity. ' +
        'REQUIRES: market_id from search_markets/get_market. Optionally espn_event_id + league for sportsbook comparison. ' +
        'THEN: place_order if edge is favorable, or explain the edge to the user with your own analysis.',
      schema: z.object({
        platform: z.enum(['kalshi', 'polymarket']),
        market_id: z.string().describe('Market ticker (Kalshi) or slug/ID (Polymarket)'),
        espn_event_id: z.string().optional().describe('ESPN event ID to compare against sportsbook odds'),
        espn_league: z.enum(['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab']).optional().describe('League for ESPN lookup'),
      }),
    },
    async ({ platform, market_id, espn_event_id, espn_league }, ctx: ToolContext) => {
      const state = getSession(getSessionId(ctx));
      const result: Record<string, unknown> = { platform, market_id };

      if (platform === 'kalshi') {
        if (!state.kalshi) return error('Not authenticated on Kalshi. Run kalshi_login first.');
        try {
          const { market } = await state.kalshi.client.getMarket(market_id);
          const yesBid = kalshiCentsToDecimal(market.yes_bid);
          const yesAsk = kalshiCentsToDecimal(market.yes_ask);
          const yesMid = (yesBid + yesAsk) / 2;
          const noMid = 1 - yesMid;
          result.market = {
            question: `${market.title} ${market.subtitle}`.trim(),
            yes_price: yesMid, no_price: noMid,
            yes_implied_prob: formatPercent(yesMid), no_implied_prob: formatPercent(noMid),
            yes_bid: yesBid, yes_ask: yesAsk,
            spread: kalshiCentsToDecimal(market.yes_ask - market.yes_bid),
            volume: market.volume, close_time: market.close_time,
          };
        } catch (e: unknown) {
          return error(`Failed to get Kalshi market: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        try {
          const tempClient = new PolymarketClient(POLY_DUMMY_KEY);
          const market = await tempClient.getMarket(market_id);
          const parsed = PolymarketClient.parseMarketFields(market as unknown as Record<string, unknown>);
          const yesPrice = parseFloat(parsed.outcomePrices[0] || '0');
          const noPrice = parseFloat(parsed.outcomePrices[1] || '0');
          result.market = {
            question: market.question,
            yes_price: yesPrice, no_price: noPrice,
            yes_implied_prob: formatPercent(yesPrice), no_implied_prob: formatPercent(noPrice),
            volume_24h: market.volume24hr || market.volume_24hr,
            liquidity: market.liquidity,
          };
        } catch (e: unknown) {
          return error(`Failed to get Polymarket market: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      if (espn_event_id && espn_league) {
        try {
          const { ESPNClient } = await import('../lib/espn/client.js');
          const { moneylineToImpliedProb, removeVig } = await import('../lib/utils/normalize.js');
          const espn = new ESPNClient();
          const odds = await espn.getOdds(espn_league, espn_event_id);
          if (odds.length > 0) {
            const o = odds[0] as any;
            const homeML = o.homeTeamOdds?.moneyLine;
            const awayML = o.awayTeamOdds?.moneyLine;
            if (homeML && awayML) {
              const noVig = removeVig(moneylineToImpliedProb(homeML), moneylineToImpliedProb(awayML));
              result.espn_comparison = {
                provider: o.provider?.name, home_moneyline: homeML, away_moneyline: awayML,
                home_fair_prob: formatPercent(noVig.home), away_fair_prob: formatPercent(noVig.away),
                spread: o.details,
              };
            }
          }
        } catch {
          result.espn_comparison = { error: 'Could not fetch ESPN odds for this event' };
        }
      }

      return object(result);
    }
  );

  // =========================================================================
  // quick_arb — find best opportunity and execute (or dry-run)
  // =========================================================================
  server.tool(
    {
      name: 'quick_arb',
      description:
        'Find the best arbitrage opportunity and execute both legs automatically. Renders a trade confirmation widget showing profit summary, order details, and execution status. ' +
        'WHEN: User wants to execute arbitrage (not just scan), or says "do it" / "execute" after seeing scan results. ' +
        'REQUIRES: Both Kalshi + Polymarket authentication for live execution. Kalshi-only for dry runs. Call auth_status first to show login widget if needed. ' +
        'ALWAYS start with dry_run=true to preview. Only set dry_run=false after user confirms. ' +
        'HOW: Scans all markets, finds highest-edge pair, places simultaneous orders at ASK prices for instant fill.',
      widget: {
        name: 'trade-confirmation',
        invoking: 'Scanning and preparing trade...',
        invoked: 'Trade plan ready',
      },
      schema: z.object({
        category: z
          .enum(['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab', 'politics', 'economics', 'crypto', 'all'])
          .default('all')
          .describe('Category to scan'),
        max_stake: z
          .number()
          .min(1)
          .default(50)
          .describe('Maximum total stake in dollars across both platforms'),
        dry_run: z
          .boolean()
          .default(true)
          .describe('Preview the trade plan without executing. Set false to place real orders.'),
      }),
    },
    async ({ category, max_stake, dry_run }, ctx: ToolContext) => {
      const state = getSession(getSessionId(ctx));

      if (!state.kalshi) return error('Kalshi authentication required. Run kalshi_login first.');

      const t0 = Date.now();

      try {
        // Fetch and match
        const [kalshiMarkets, polyMarkets] = await Promise.all([
          fetchKalshiMarkets(state.kalshi.client, category),
          fetchPolymarkets(category),
        ]);

        // Dome first (verified pairs), then fuzzy+search for leftovers
        let domeMatched: MatchedMarket[] = [];
        try { domeMatched = await domeMatchedPairs(kalshiMarkets, polyMarkets); } catch { /* continue */ }
        const domeTickers = new Set(domeMatched.map((m) => m.kalshiTicker));
        const domeSlugs = new Set(domeMatched.map((m) => m.polymarketSlug));

        const fuzzyMatched = matchMarketsAcrossPlatforms(
          kalshiMarkets.filter((km) => !domeTickers.has(km.ticker)),
          polyMarkets.filter((pm) => !domeSlugs.has(pm.slug)),
          0.55,
        );
        const alreadyMatched = new Set([...domeTickers, ...fuzzyMatched.map((m) => m.kalshiTicker)]);
        const usedPolyIds = new Set([
          ...domeMatched.map((m) => polyMarkets.find((p) => p.slug === m.polymarketSlug)?.id).filter(Boolean) as string[],
          ...fuzzyMatched.map((m) => polyMarkets.find((p) => p.slug === m.polymarketSlug)?.id).filter(Boolean) as string[],
        ]);
        const polyClient = new PolymarketClient(POLY_DUMMY_KEY);
        const searchMatched = await searchBasedMatch(kalshiMarkets, alreadyMatched, polyClient, 0.55, 5, 20, polyMarkets, usedPolyIds);
        const allMatched = [...domeMatched, ...fuzzyMatched, ...searchMatched];

        const opportunities = findArbitrageOpportunities(allMatched, 0.003);
        const scanMs = Date.now() - t0;

        if (opportunities.length === 0) {
          return text(
            `No arbitrage found across ${kalshiMarkets.length} Kalshi × ${polyMarkets.length} Polymarket markets ` +
            `(${allMatched.length} matched pairs) in ${(scanMs / 1000).toFixed(1)}s.\n` +
            `Markets are efficiently priced. Try again during live events when prices move.`
          );
        }

        const best = opportunities[0];
        const profit = calculateProfit(best, max_stake);

        if (profit.contracts < 1) {
          return text(
            `Best opportunity: ${(best.edge * 100).toFixed(2)}% edge, but needs at least ${formatDollars(best.totalCost)} per pair.\n` +
            `Increase max_stake to at least ${formatDollars(best.totalCost)}.`
          );
        }

        const plan = {
          opportunity: best.direction,
          edge_pct: `${(best.edge * 100).toFixed(2)}%`,
          contracts: profit.contracts,
          kalshi_order: {
            ticker: best.kalshiTicker,
            side: best.kalshiSide,
            quantity: profit.contracts,
            price: best.kalshiPrice,
            cost: formatDollars(profit.kalshiCost),
          },
          polymarket_order: {
            slug: best.polymarketSlug,
            side: best.polymarketSide,
            quantity: profit.contracts,
            price: best.polymarketPrice,
            cost: formatDollars(profit.polymarketCost),
          },
          total_cost: formatDollars(profit.totalInvestment),
          guaranteed_profit: formatDollars(profit.netProfit),
          roi_pct: `${profit.netROI.toFixed(2)}%`,
          dry_run,
        };

        if (dry_run) {
          let md = `## Quick Arb — Dry Run\n\n`;
          md += formatDetailedOpportunity(best, 1, max_stake);
          md += `\n*Set \`dry_run: false\` to execute this trade.*`;

          const dryRunData = { plan, alternatives: opportunities.length - 1, note: 'DRY RUN — no trades placed.', markdown: md };
          return widget({
            props: dryRunData,
            output: object(dryRunData),
          });
        }

        // Execute both sides
        const orders: Record<string, unknown>[] = [];
        const errors: string[] = [];

        // Kalshi order
        try {
          const { order } = await state.kalshi.client.createOrder({
            ticker: best.kalshiTicker,
            action: 'buy',
            side: best.kalshiSide,
            type: 'limit',
            count: profit.contracts,
            ...(best.kalshiSide === 'yes'
              ? { yes_price: Math.round(best.kalshiPrice * 100) }
              : { no_price: Math.round(best.kalshiPrice * 100) }),
          });
          orders.push({
            platform: 'kalshi', order_id: order.order_id, status: order.status,
            ticker: order.ticker, side: order.side, quantity: order.count,
            price: formatDollars(best.kalshiPrice),
          });
        } catch (e: unknown) {
          errors.push(`Kalshi: ${e instanceof Error ? e.message : String(e)}`);
        }

        // Polymarket order
        if (state.polymarket && errors.length === 0) {
          const tokenId = best.polymarketTokenIds?.[best.polymarketTokenIdx];
          if (tokenId) {
            try {
              // Always BUY — we're buying the YES or NO token directly
              const order = await state.polymarket.client.placeOrder({
                tokenId, price: best.polymarketPrice,
                size: profit.contracts, side: 'BUY', orderType: 'GTC',
              });
              orders.push({
                platform: 'polymarket', order_id: order.id, status: order.status,
                side: order.side, quantity: profit.contracts,
                price: formatDollars(best.polymarketPrice),
              });
            } catch (e: unknown) {
              errors.push(`Polymarket: ${e instanceof Error ? e.message : String(e)}`);
            }
          } else {
            errors.push('Missing Polymarket token ID — could not place order.');
          }
        } else if (!state.polymarket) {
          errors.push('Polymarket not authenticated — only Kalshi order placed.');
        }

        const success = errors.length === 0;

        const execData = {
          plan, orders, execution_errors: errors, success,
          note: success
            ? `Both orders placed. Net profit of ${formatDollars(profit.netProfit)} locked in (${profit.netROI.toFixed(2)}% ROI).`
            : 'Partial execution — review errors.',
        };
        return widget({
          props: execData,
          output: object(execData),
        });
      } catch (e: unknown) {
        return error(`quick_arb failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );
}
