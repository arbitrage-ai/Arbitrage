import { z } from 'zod';
import { text, error, object, widget } from 'mcp-use/server';
import type { McpServerInstance, ToolContext } from 'mcp-use/server';
import { getSession } from '../lib/utils/session.js';
import { getSessionId } from '../lib/utils/ctx.js';
import {
  kalshiCentsToDecimal,
  formatDollars,
  formatPercent,
} from '../lib/utils/normalize.js';
import { PolymarketClient } from '../lib/polymarket/client.js';
import { DomeClient } from '../lib/dome/client.js';

const DOME_API_KEY = process.env.DOME_API_KEY || '220e4cdeb2b55ec2c3bba7b330410d13f56321c8';
const dome = new DomeClient(DOME_API_KEY);

const COMBO_MARKET_PATTERNS = [
  'multigame',
  'multi-game',
  'extended',
  'combo',
  'parlay',
];

function isLikelyComboMarket(...parts: Array<string | undefined>): boolean {
  const joined = parts.filter(Boolean).join(' ').toLowerCase();
  return COMBO_MARKET_PATTERNS.some((pattern) => joined.includes(pattern));
}

export function registerMarketTools(server: McpServerInstance) {
  server.tool(
    {
      name: 'suggest_markets',
      description:
        'Surface tradeable prediction markets for any topic the user is discussing. ' +
        'WHEN: User mentions any real-world topic, current event, opinion, or expresses profit intent. ' +
        'Pass topic="trending" for money/profit queries to show highest-volume markets. ' +
        'THEN: Follow up with scan_arbitrage or scan_mispricing for profit opportunities. ' +
        'For sports topics, also call live_scores and espn_odds for richer context.',
      schema: z.object({
        topic: z
          .string()
          .default('trending')
          .describe('The topic from conversation, or "trending" for highest-volume actionable markets'),
        context: z
          .string()
          .optional()
          .describe('Additional context about what the user is discussing'),
      }),
    },
    async ({ topic, context }, ctx: ToolContext) => {
      try {
        const state = getSession(getSessionId(ctx));
        const results: unknown[] = [];

        const polyClient = state.polymarket?.client || new PolymarketClient(
          '0x0000000000000000000000000000000000000000000000000000000000000001'
        );

        // Polymarket — try searchText, fall back to events when it returns 422
        try {
          let markets: import('../lib/polymarket/types.js').PolymarketMarket[] = [];
          try {
            const raw = await polyClient.searchText(topic);
            markets = Array.isArray(raw) ? (raw as import('../lib/polymarket/types.js').PolymarketMarket[]) : [];
          } catch {
            const events = await polyClient.searchEvents({ active: true, closed: false, limit: 30, order: 'volume24hr', ascending: false });
            for (const ev of events) {
              if (Array.isArray(ev.markets)) markets.push(...ev.markets);
            }
            const kw = (topic || '').toLowerCase().split(/\s+/).filter((w) => w.length > 2);
            if (kw.length > 0 && topic !== 'trending') {
              markets = markets.filter((m) => {
                const t = `${m.question || ''} ${m.slug || ''}`.toLowerCase();
                return kw.some((w) => t.includes(w));
              });
            }
          }

          // Filter out closed/inactive markets
          markets = markets.filter((m) => !m.closed && m.active !== false);

          // Deduplicate: pick one (highest-volume) market per event.
          // Group by normalized question pattern (strip specific names/dates).
          const eventBuckets = new Map<string, typeof markets[0]>();
          for (const m of markets) {
            const q = (m.question || m.slug || '').toLowerCase();
            const key = q
              .replace(/\b(will|the|a|an|in|on|by|of|for|to|as|be)\b/g, '')
              .replace(/\b\d{4}\b/g, '')
              .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/g, '')
              .replace(/\b\d{1,2}(st|nd|rd|th)?\b/g, '')
              .replace(/\b[A-Z][a-z]+\b/gi, (w) => w.length > 4 ? '' : w)
              .replace(/[^a-z]+/g, '-')
              .replace(/-+/g, '-')
              .slice(0, 30);
            const existing = eventBuckets.get(key);
            const vol = Number(m.volume_24hr || m.volume24hr || 0);
            if (!existing || vol > Number((existing as any).volume_24hr || (existing as any).volume24hr || 0)) {
              eventBuckets.set(key, m);
            }
          }
          const finalMarkets = [...eventBuckets.values()]
            .sort((a, b) => Number(b.volume_24hr || b.volume24hr || 0) - Number(a.volume_24hr || a.volume24hr || 0))
            .slice(0, 8);

          for (const m of finalMarkets) {
            const parsed = PolymarketClient.parseMarketFields(m as unknown as Record<string, unknown>);
            const yp = parseFloat(parsed.outcomePrices[0] || '0');
            results.push({
              platform: 'polymarket',
              question: m.question,
              yes_price: `${(yp * 100).toFixed(1)}%`,
              volume_24h: m.volume_24hr || m.volume24hr || 0,
              liquidity: m.liquidity || '0',
              slug: m.slug,
              token_ids: parsed.clobTokenIds,
            });
          }
        } catch { /* non-critical */ }

        // Kalshi search via Dome API (text search, works without auth)
        try {
          const searchTerm = (!topic || topic === 'trending') ? undefined : topic;
          const { markets: kalshiResults } = await dome.searchKalshiMarkets({
            search: searchTerm,
            status: 'open',
            limit: 8,
            min_volume: 1000,
          });
          for (const m of kalshiResults) {
            if (isLikelyComboMarket(m.market_ticker, m.title)) continue;
            results.push({
              platform: 'kalshi',
              question: m.title,
              yes_price: `${m.last_price}¢`,
              volume_24h: m.volume_24h || 0,
              ticker: m.market_ticker,
            });
          }
        } catch { /* non-critical */ }

        if (results.length === 0) {
          return object({
            topic,
            markets: [],
            count: 0,
            next_steps: [
              { tool: 'scan_arbitrage', reason: 'No markets for this topic — scan all categories for profit opportunities instead' },
              { tool: 'search_markets', params: { query: topic }, reason: 'Try a more specific search query' },
            ],
          });
        }

        const hasBothPlatforms = new Set((results as Record<string, unknown>[]).map((r) => r.platform)).size > 1;

        let md = `## Markets Related to: ${topic}\n\n`;
        if (context) md += `*Context: ${context}*\n\n`;
        for (const r of results) {
          const m = r as Record<string, unknown>;
          md += `- **${m.question}** (${m.platform}) — YES ${m.yes_price}`;
          if (m.volume_24h) md += ` | 24h vol: $${Number(m.volume_24h).toLocaleString()}`;
          md += `\n`;
        }

        const nextSteps: { tool: string; params?: Record<string, unknown>; reason: string }[] = [];
        if (hasBothPlatforms) {
          nextSteps.push({ tool: 'scan_arbitrage', params: { category: 'all' }, reason: 'Markets on both platforms — check for cross-platform arbitrage' });
        }
        nextSteps.push({ tool: 'scan_mispricing', reason: 'Check multi-outcome events for mispricing' });

        return object({ topic, markets: results, count: results.length, next_steps: nextSteps, markdown: md });
      } catch (e: unknown) {
        return error(`suggest_markets failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  server.tool(
    {
      name: 'search_markets',
      description:
        'Search for specific prediction markets by query string. ' +
        'WHEN: User mentions a specific event, matchup, or question they want to bet on (e.g. "Lakers vs Celtics", "Will Bitcoin hit $100K"). ' +
        'USE suggest_markets INSTEAD when the topic is broad/conversational. Use search_markets when the user has a specific query. ' +
        'THEN: Use get_market for details on a result, or get_orderbook to check liquidity before trading.',
      widget: {
        name: 'order-entry',
        invoking: 'Searching markets...',
        invoked: 'Markets found',
      },
      schema: z.object({
        query: z
          .string()
          .describe(
            'Search query — anything people might bet on: "Lakers vs Celtics", "Will Bitcoin hit $100K", "next president", "Fed interest rate", "Tesla earnings"'
          ),
        platform: z
          .enum(['kalshi', 'polymarket', 'both'])
          .default('both')
          .describe('Which platform to search'),
        limit: z
          .number()
          .default(20)
          .describe('Max results per platform'),
        include_combo: z
          .boolean()
          .default(false)
          .describe(
            'Include combo/extended/parlay-style markets (default: false)'
          ),
      }),
    },
    async ({ query, platform, limit, include_combo }, ctx: ToolContext) => {
      try {
        const state = getSession(getSessionId(ctx));
        const results: unknown[] = [];
        const queryLower = (query || '').toLowerCase();

        // Search Kalshi via Dome API (text search, no auth needed)
        if (platform === 'kalshi' || platform === 'both') {
          try {
            const { markets: kalshiMarkets } = await dome.searchKalshiMarkets({
              search: query,
              status: 'open',
              limit: Math.min(limit, 20),
            });
            for (const m of kalshiMarkets) {
              if (!include_combo && isLikelyComboMarket(m.market_ticker, m.event_ticker, m.title)) continue;
              results.push({
                platform: 'kalshi',
                ticker: m.market_ticker,
                event: m.event_ticker,
                question: m.title,
                yes_price: formatPercent(m.last_price / 100),
                no_price: formatPercent(1 - m.last_price / 100),
                last_price: m.last_price,
                volume: m.volume,
                volume_24h: m.volume_24h,
                status: m.status,
              });
            }
          } catch (e: unknown) {
            results.push({
              platform: 'kalshi',
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }

        // Search Polymarket via Dome API (text search) with Gamma fallback
        if (platform === 'polymarket' || platform === 'both') {
          try {
            // Primary: Dome API search
            const { markets: domeResults } = await dome.searchPolymarketMarkets({
              search: query,
              status: 'open',
              limit: Math.min(limit, 20),
            });

            if (domeResults.length > 0) {
              for (const m of domeResults) {
                if (!include_combo && isLikelyComboMarket(m.market_slug, m.title)) continue;
                results.push({
                  platform: 'polymarket',
                  slug: m.market_slug,
                  event_slug: m.event_slug,
                  question: m.title,
                  volume_total: m.volume_total,
                  volume_1_week: m.volume_1_week,
                  status: m.status,
                  side_a: m.side_a,
                  side_b: m.side_b,
                  tags: m.tags,
                });
              }
            } else {
              // Fallback: Gamma API search
              const client =
                state.polymarket?.client ||
                new PolymarketClient(
                  '0x0000000000000000000000000000000000000000000000000000000000000001'
                );

              let polyMarkets: import('../lib/polymarket/types.js').PolymarketMarket[] = [];
              try {
                const rawSearch = await client.searchText(query);
                polyMarkets = Array.isArray(rawSearch) ? (rawSearch as import('../lib/polymarket/types.js').PolymarketMarket[]).slice(0, limit * 2) : [];
              } catch { /* searchText 422 fallback */ }
              if (polyMarkets.length === 0) {
                const events = await client.searchEvents({ active: true, closed: false, limit: 50, order: 'volume24hr', ascending: false });
                const allMarkets: import('../lib/polymarket/types.js').PolymarketMarket[] = [];
                for (const ev of events) {
                  if (Array.isArray(ev.markets)) allMarkets.push(...ev.markets);
                }
                const kw = queryLower.split(/\s+/).filter((w) => w.length > 2);
                polyMarkets = allMarkets.filter((m) => {
                  const mtext = `${m.question || ''} ${m.slug || ''}`.toLowerCase();
                  return kw.some((w) => mtext.includes(w));
                });
              }

              const matched = polyMarkets
                .filter((m) => !m.closed && m.active !== false)
                .filter(
                  (m) =>
                    include_combo ||
                    !isLikelyComboMarket(m.slug, m.question, m.description)
                )
                .slice(0, limit);

              for (const m of matched) {
                const parsed = PolymarketClient.parseMarketFields(m as unknown as Record<string, unknown>);
                const yesPrice = parseFloat(parsed.outcomePrices[0] || '0');
                const noPrice = parseFloat(parsed.outcomePrices[1] || '0');
                results.push({
                  platform: 'polymarket',
                  slug: m.slug,
                  question: m.question,
                  yes_price: formatPercent(yesPrice),
                  no_price: formatPercent(noPrice),
                  yes_decimal: yesPrice,
                  no_decimal: noPrice,
                  volume_24h: m.volume_24hr || m.volume24hr,
                  liquidity: m.liquidity,
                  end_date: m.end_date || m.endDate,
                  token_ids: parsed.clobTokenIds,
                });
              }
            }
          } catch (e: unknown) {
            results.push({
              platform: 'polymarket',
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }

        if (results.length === 0) {
          return text(
            `No markets found for "${query}". Try a broader search term.`
          );
        }

        const markets = results.map((r: any) => ({
          ...r,
          title: r.question || r.title || '',
        }));

        const searchData = {
          query,
          include_combo,
          markets,
          count: markets.length,
        };
        return widget({
          props: searchData,
          output: object(searchData),
        });
      } catch (e: unknown) {
        return error(`search_markets failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  );

  server.tool(
    {
      name: 'get_market',
      description:
        'Get detailed info on a specific market (prices, volume, liquidity, token IDs). ' +
        'WHEN: User asks about a specific market, or you need token IDs / current prices before placing an order. ' +
        'REQUIRES: A market_id from search_markets or suggest_markets results. ' +
        'THEN: get_orderbook for depth, analyze_edge for edge analysis, or place_order to trade.',
      schema: z.object({
        platform: z.enum(['kalshi', 'polymarket']),
        market_id: z
          .string()
          .describe(
            'Market identifier: Kalshi ticker (e.g., "NBAGSW-25FEB21-LAL") or Polymarket market ID/slug'
          ),
      }),
    },
    async ({ platform, market_id }, ctx: ToolContext) => {
      if (platform === 'kalshi') {
        const state = getSession(getSessionId(ctx));
        if (!state.kalshi) {
          return error('Not authenticated on Kalshi. Run kalshi_login first.');
        }
        try {
          const { market } = await state.kalshi.client.getMarket(market_id);
          return object({
            platform: 'kalshi',
            ticker: market.ticker,
            event: market.event_ticker,
            title: market.title,
            subtitle: market.subtitle,
            status: market.status,
            yes_bid: market.yes_bid,
            yes_ask: market.yes_ask,
            no_bid: market.no_bid,
            no_ask: market.no_ask,
            last_price: market.last_price,
            volume: market.volume,
            open_interest: market.open_interest,
            close_time: market.close_time,
            rules: market.rules_primary,
            result: market.result,
          });
        } catch (e: unknown) {
          return error(
            `Failed to get Kalshi market: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      } else {
        try {
          const tempClient = new PolymarketClient(
            '0x0000000000000000000000000000000000000000000000000000000000000001'
          );
          const market = await tempClient.getMarket(market_id);
          const parsed = PolymarketClient.parseMarketFields(market as unknown as Record<string, unknown>);
          return object({
            platform: 'polymarket',
            id: market.id,
            question: market.question,
            slug: market.slug,
            outcomes: parsed.outcomes,
            outcome_prices: parsed.outcomePrices,
            token_ids: parsed.clobTokenIds,
            volume: market.volume,
            volume_24h: market.volume_24hr || market.volume24hr,
            liquidity: market.liquidity,
            end_date: market.end_date || market.endDate,
            resolution_source: market.resolution_source || market.resolutionSource,
            description: market.description,
          });
        } catch (e: unknown) {
          return error(
            `Failed to get Polymarket market: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
    }
  );

  server.tool(
    {
      name: 'get_orderbook',
      description:
        'Get orderbook depth (bids/asks) at each price level. ' +
        'WHEN: Before placing large orders (>10 contracts), or verifying executable prices after scan_mispricing (Polymarket midpoints may differ from ask). ' +
        'REQUIRES: Market ticker (Kalshi) or token_id (Polymarket) from get_market results.',
      schema: z.object({
        platform: z.enum(['kalshi', 'polymarket']),
        market_id: z
          .string()
          .describe(
            'Market identifier: Kalshi ticker or Polymarket token_id'
          ),
      }),
    },
    async ({ platform, market_id }, ctx: ToolContext) => {
      if (platform === 'kalshi') {
        const state = getSession(getSessionId(ctx));
        if (!state.kalshi) {
          return error('Not authenticated on Kalshi. Run kalshi_login first.');
        }
        try {
          const { orderbook } =
            await state.kalshi.client.getOrderbook(market_id);

          const yesBids = (orderbook.yes || []).map(([price, qty]) => ({
            price: kalshiCentsToDecimal(price),
            quantity: qty,
          }));
          const noBids = (orderbook.no || []).map(([price, qty]) => ({
            price: kalshiCentsToDecimal(price),
            quantity: qty,
          }));

          const bestYes = yesBids[0]?.price ?? 0;
          const bestNo = noBids[0]?.price ?? 0;
          const spread = 1 - bestYes - bestNo;

          return object({
            platform: 'kalshi',
            ticker: market_id,
            yes_bids: yesBids.slice(0, 10),
            no_bids: noBids.slice(0, 10),
            best_yes: bestYes,
            best_no: bestNo,
            spread: spread.toFixed(4),
          });
        } catch (e: unknown) {
          return error(
            `Failed to get orderbook: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      } else {
        const state = getSession(getSessionId(ctx));
        // Try auth'd CLOB first, fallback to Dome API (no auth needed)
        if (state.polymarket) {
          try {
            const book =
              await state.polymarket.client.getOrderbook(market_id);
            return object({
              platform: 'polymarket',
              token_id: market_id,
              bids: (book.bids || []).slice(0, 10),
              asks: (book.asks || []).slice(0, 10),
            });
          } catch { /* fall through to Dome */ }
        }
        try {
          const price = await dome.getPolymarketMarketPrice(market_id);
          return object({
            platform: 'polymarket',
            token_id: market_id,
            price: price.price,
            at_time: price.at_time,
            note: 'Price from Dome API. For full orderbook depth, authenticate with polymarket_login.',
          });
        } catch (e: unknown) {
          return error(
            `Failed to get orderbook: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
    }
  );
}
