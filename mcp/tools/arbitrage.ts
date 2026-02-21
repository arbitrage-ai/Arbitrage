import { z } from 'zod';
import { text, error, object, markdown } from 'mcp-use/server';
import type { McpServerInstance, ToolContext } from 'mcp-use/server';
import { getSession } from '../lib/utils/session.js';
import { getSessionId } from '../lib/utils/ctx.js';
import { KalshiClient } from '../lib/kalshi/client.js';
import { PolymarketClient } from '../lib/polymarket/client.js';
import { matchMarketsAcrossPlatforms } from '../lib/arbitrage/matcher.js';
import {
  findArbitrageOpportunities,
  sizePosition,
} from '../lib/arbitrage/engine.js';
import { kalshiCentsToDecimal, formatDollars, formatPercent } from '../lib/utils/normalize.js';
import type { KalshiMarket } from '../lib/kalshi/types.js';
import type { PolymarketMarket } from '../lib/polymarket/types.js';

// Sport → Kalshi series ticker prefix mapping
const SPORT_KALSHI_SERIES: Record<string, string[]> = {
  nfl: ['NFL', 'SUPER'],
  nba: ['NBA', 'NBAGSW', 'NBALAL'],
  mlb: ['MLB'],
  nhl: ['NHL'],
  ncaaf: ['CFB', 'NCAAF'],
  ncaab: ['NCAA', 'NCAAB'],
  all: [],
};

// Sport → Polymarket tag IDs (approximate — sports tag IDs)
const SPORT_POLY_TAGS: Record<string, number[]> = {
  nfl: [100381, 100382],
  nba: [100383, 100384],
  mlb: [100385],
  nhl: [100386],
  ncaaf: [100387],
  ncaab: [100388],
  all: [],
};

async function fetchKalshiMarkets(
  kalshiClient: KalshiClient,
  sport: string
): Promise<KalshiMarket[]> {
  const seriesPrefixes = SPORT_KALSHI_SERIES[sport] || [];
  const allMarkets: KalshiMarket[] = [];

  if (seriesPrefixes.length === 0) {
    // Fetch all open markets
    const { markets } = await kalshiClient.getMarkets({
      status: 'open',
      limit: 200,
    });
    allMarkets.push(...markets);
  } else {
    // Fetch by series prefix
    for (const prefix of seriesPrefixes) {
      try {
        const { markets } = await kalshiClient.getMarkets({
          status: 'open',
          series_ticker: prefix,
          limit: 100,
        });
        allMarkets.push(...markets);
      } catch {
        // Series might not exist, skip
      }
    }

    // If nothing found by series, fetch all and filter
    if (allMarkets.length === 0) {
      const { markets } = await kalshiClient.getMarkets({
        status: 'open',
        limit: 200,
      });
      const filtered = markets.filter((m) =>
        seriesPrefixes.some((p) =>
          m.ticker.startsWith(p) || m.event_ticker.startsWith(p)
        )
      );
      allMarkets.push(...filtered);
    }
  }

  return allMarkets;
}

async function fetchPolymarkets(sport: string): Promise<PolymarketMarket[]> {
  const tagIds = SPORT_POLY_TAGS[sport] || [];
  const tempClient = new PolymarketClient(
    '0x0000000000000000000000000000000000000000000000000000000000000001'
  );

  if (tagIds.length === 0) {
    return tempClient.searchMarkets({ active: true, closed: false, limit: 200 });
  }

  const allMarkets: PolymarketMarket[] = [];
  for (const tagId of tagIds) {
    try {
      const markets = await tempClient.searchMarkets({
        active: true,
        closed: false,
        tag_id: tagId,
        limit: 100,
      });
      allMarkets.push(...markets);
    } catch {
      // Tag might not exist
    }
  }

  // Fall back to broader search if no sport-specific markets found
  if (allMarkets.length === 0) {
    return tempClient.searchMarkets({ active: true, closed: false, limit: 200 });
  }

  return allMarkets;
}

export function registerArbitrageTools(server: McpServerInstance) {
  server.tool(
    {
      name: 'scan_arbitrage',
      description:
        'Scan for cross-platform arbitrage opportunities between Kalshi and Polymarket on sports markets. Finds situations where buying YES on one platform + NO on the other guarantees a profit.',
      schema: z.object({
        sport: z
          .enum(['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab', 'all'])
          .default('all')
          .describe('Which sport to scan (default: all)'),
        min_edge: z
          .number()
          .min(0)
          .max(1)
          .default(0.01)
          .describe(
            'Minimum edge threshold as a decimal (0.01 = 1% guaranteed profit)'
          ),
        max_results: z
          .number()
          .default(10)
          .describe('Maximum number of opportunities to return'),
      }),
    },
    async ({ sport, min_edge, max_results }, ctx: ToolContext) => {
      const state = getSession(getSessionId(ctx));

      if (!state.kalshi) {
        return error(
          'Kalshi authentication required for arbitrage scanning. Run kalshi_login first.'
        );
      }

      try {
        // Fetch markets from both platforms in parallel
        const [kalshiMarkets, polyMarkets] = await Promise.all([
          fetchKalshiMarkets(state.kalshi.client, sport),
          fetchPolymarkets(sport),
        ]);

        if (kalshiMarkets.length === 0) {
          return text(
            `No open Kalshi markets found for sport: ${sport}. Markets may not be available right now.`
          );
        }

        if (polyMarkets.length === 0) {
          return text(
            `No active Polymarket markets found for sport: ${sport}.`
          );
        }

        // Match markets across platforms
        const matched = matchMarketsAcrossPlatforms(
          kalshiMarkets,
          polyMarkets
        );

        if (matched.length === 0) {
          return text(
            `No matching markets found between Kalshi (${kalshiMarkets.length} markets) and Polymarket (${polyMarkets.length} markets) for sport: ${sport}. Markets may cover different events.`
          );
        }

        // Find arbitrage opportunities
        const opportunities = findArbitrageOpportunities(matched, min_edge);

        if (opportunities.length === 0) {
          return markdown(
            `## Arbitrage Scan Results — No Opportunities\n\n` +
              `Scanned **${matched.length} matched market pairs** across Kalshi and Polymarket.\n` +
              `No arbitrage opportunities found with edge ≥ ${(min_edge * 100).toFixed(1)}%.\n\n` +
              `The markets appear to be fairly priced relative to each other. ` +
              `Try a lower \`min_edge\` value or check back during live games when prices move faster.`
          );
        }

        const top = opportunities.slice(0, max_results);

        let md = `## Arbitrage Opportunities Found — ${sport.toUpperCase()}\n\n`;
        md += `Scanned ${matched.length} matched pairs · Found **${opportunities.length} opportunities**\n\n`;

        for (let i = 0; i < top.length; i++) {
          const opp = top[i];
          md += `### ${i + 1}. ${opp.eventName}\n`;
          md += `**Edge:** ${(opp.edge * 100).toFixed(2)}% · **ROI:** ${opp.roi.toFixed(2)}% · **Profit/contract:** ${formatDollars(opp.profitPerContract)}\n`;
          md += `**Trade:** ${opp.direction}\n`;
          md += `**Match confidence:** ${(opp.matchConfidence * 100).toFixed(0)}%\n\n`;
        }

        md += `---\n*Use \`quick_arb\` to execute the best opportunity automatically.*`;

        return object({
          scan_summary: {
            sport,
            kalshi_markets_fetched: kalshiMarkets.length,
            polymarket_markets_fetched: polyMarkets.length,
            matched_pairs: matched.length,
            opportunities_found: opportunities.length,
            min_edge_filter: min_edge,
          },
          opportunities: top.map((o) => ({
            id: o.id,
            event: o.eventName,
            trade: o.direction,
            edge_pct: parseFloat((o.edge * 100).toFixed(2)),
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
          })),
          markdown: md,
        });
      } catch (e: unknown) {
        return error(
          `Arbitrage scan failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  );

  server.tool(
    {
      name: 'analyze_edge',
      description:
        'Analyze the edge on a specific market by comparing prediction market prices vs ESPN implied probabilities from real sportsbooks.',
      schema: z.object({
        platform: z.enum(['kalshi', 'polymarket']),
        market_id: z
          .string()
          .describe('Market ticker (Kalshi) or slug/ID (Polymarket)'),
        espn_event_id: z
          .string()
          .optional()
          .describe(
            'ESPN event ID to compare against sportsbook odds (get from live_scores)'
          ),
        espn_league: z
          .enum(['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab'])
          .optional()
          .describe('League for ESPN lookup'),
      }),
    },
    async ({ platform, market_id, espn_event_id, espn_league }, ctx: ToolContext) => {
      const state = getSession(getSessionId(ctx));
      const result: Record<string, unknown> = { platform, market_id };

      // Get prediction market data
      if (platform === 'kalshi') {
        if (!state.kalshi) {
          return error('Not authenticated on Kalshi. Run kalshi_login first.');
        }
        try {
          const { market } = await state.kalshi.client.getMarket(market_id);
          const yesPrice = kalshiCentsToDecimal(market.yes_bid);
          const noPrice = kalshiCentsToDecimal(market.no_bid);
          result.market = {
            question: `${market.title} ${market.subtitle}`.trim(),
            yes_price: yesPrice,
            no_price: noPrice,
            yes_implied_prob: formatPercent(yesPrice),
            no_implied_prob: formatPercent(noPrice),
            volume: market.volume,
            close_time: market.close_time,
          };
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
          const yesPrice = parseFloat(market.outcome_prices?.[0] || '0');
          const noPrice = parseFloat(market.outcome_prices?.[1] || '0');
          result.market = {
            question: market.question,
            yes_price: yesPrice,
            no_price: noPrice,
            yes_implied_prob: formatPercent(yesPrice),
            no_implied_prob: formatPercent(noPrice),
            volume_24h: market.volume_24hr,
            liquidity: market.liquidity,
          };
        } catch (e: unknown) {
          return error(
            `Failed to get Polymarket market: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }

      // Compare against ESPN odds if provided
      if (espn_event_id && espn_league) {
        try {
          const { ESPNClient } = await import('../lib/espn/client.js');
          const { moneylineToImpliedProb, removeVig } = await import(
            '../lib/utils/normalize.js'
          );
          const espn = new ESPNClient();
          const odds = await espn.getOdds(espn_league, espn_event_id);

          if (odds.length > 0) {
            const o = odds[0] as any;
            const homeML = o.homeTeamOdds?.moneyLine;
            const awayML = o.awayTeamOdds?.moneyLine;

            if (homeML && awayML) {
              const homeProb = moneylineToImpliedProb(homeML);
              const awayProb = moneylineToImpliedProb(awayML);
              const noVig = removeVig(homeProb, awayProb);

              result.espn_comparison = {
                provider: o.provider?.name,
                home_moneyline: homeML,
                away_moneyline: awayML,
                home_fair_prob: formatPercent(noVig.home),
                away_fair_prob: formatPercent(noVig.away),
                spread: o.details,
              };
            }
          }
        } catch {
          result.espn_comparison = {
            error: 'Could not fetch ESPN odds for this event',
          };
        }
      }

      return object(result);
    }
  );

  server.tool(
    {
      name: 'quick_arb',
      description:
        'Find the best arbitrage opportunity and optionally execute both sides of the trade simultaneously. Use dry_run=true (default) to see the plan without executing. Set dry_run=false to actually trade.',
      schema: z.object({
        sport: z
          .enum(['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab', 'all'])
          .default('all')
          .describe('Which sport to find arbitrage in'),
        max_stake: z
          .number()
          .min(1)
          .default(10)
          .describe('Maximum total stake in dollars'),
        dry_run: z
          .boolean()
          .default(true)
          .describe(
            'If true (default), show the trade plan without executing. Set false to execute real trades.'
          ),
      }),
    },
    async ({ sport, max_stake, dry_run }, ctx: ToolContext) => {
      const state = getSession(getSessionId(ctx));

      if (!state.kalshi) {
        return error('Kalshi authentication required. Run kalshi_login first.');
      }

      try {
        // Fetch and match markets
        const [kalshiMarkets, polyMarkets] = await Promise.all([
          fetchKalshiMarkets(state.kalshi.client, sport),
          fetchPolymarkets(sport),
        ]);

        const matched = matchMarketsAcrossPlatforms(kalshiMarkets, polyMarkets);
        const opportunities = findArbitrageOpportunities(matched, 0.005);

        if (opportunities.length === 0) {
          return text(
            `No arbitrage opportunities found for ${sport} with current market prices. ` +
              `Markets are efficiently priced between Kalshi and Polymarket. ` +
              `Try again during live events when prices move quickly.`
          );
        }

        const best = opportunities[0];
        const sizing = sizePosition(best, max_stake);

        if (sizing.contracts < 1) {
          return text(
            `Best opportunity has edge of ${(best.edge * 100).toFixed(2)}% but requires at least ` +
              `${formatDollars(best.totalCost)} per contract pair. ` +
              `Increase max_stake to at least ${formatDollars(best.totalCost)}.`
          );
        }

        const plan = {
          opportunity: best.direction,
          contracts: sizing.contracts,
          kalshi_order: {
            ticker: best.kalshiTicker,
            side: best.kalshiSide,
            action: 'buy',
            quantity: sizing.contracts,
            price: best.kalshiPrice,
            cost: formatDollars(sizing.kalshiCost),
          },
          polymarket_order: {
            slug: best.polymarketSlug,
            side: best.polymarketSide,
            action: 'buy',
            quantity: sizing.contracts,
            price: best.polymarketPrice,
            cost: formatDollars(sizing.polymarketCost),
          },
          total_cost: formatDollars(sizing.totalCost),
          guaranteed_profit: formatDollars(sizing.guaranteedProfit),
          edge_pct: `${(best.edge * 100).toFixed(2)}%`,
          roi_pct: `${((sizing.guaranteedProfit / sizing.totalCost) * 100).toFixed(2)}%`,
          dry_run,
        };

        if (dry_run) {
          return object({
            plan,
            note: 'DRY RUN — No trades executed. Set dry_run=false to execute.',
          });
        }

        // Execute both sides
        const orders: Record<string, unknown>[] = [];
        const executionErrors: string[] = [];

        // Place Kalshi order
        try {
          const { order } = await state.kalshi.client.createOrder({
            ticker: best.kalshiTicker,
            action: 'buy',
            side: best.kalshiSide,
            type: 'limit',
            count: sizing.contracts,
            ...(best.kalshiSide === 'yes'
              ? { yes_price: Math.round(best.kalshiPrice * 100) }
              : { no_price: Math.round(best.kalshiPrice * 100) }),
          });
          orders.push({
            platform: 'kalshi',
            order_id: order.order_id,
            status: order.status,
            ticker: order.ticker,
            side: order.side,
            quantity: order.count,
            price: formatDollars(best.kalshiPrice),
          });
        } catch (e: unknown) {
          executionErrors.push(
            `Kalshi order failed: ${e instanceof Error ? e.message : String(e)}`
          );
        }

        // Place Polymarket order (only if auth available and Kalshi succeeded)
        if (state.polymarket && executionErrors.length === 0) {
          try {
            const pm = polyMarkets.find((m) => m.slug === best.polymarketSlug);
            if (pm && pm.clob_token_ids?.[best.polymarketTokenIdx]) {
              const tokenId = pm.clob_token_ids[best.polymarketTokenIdx];
              const order = await state.polymarket.client.placeOrder({
                tokenId,
                price: best.polymarketPrice,
                size: sizing.contracts,
                side: best.polymarketSide,
                orderType: 'GTC',
              });
              orders.push({
                platform: 'polymarket',
                order_id: order.id,
                status: order.status,
                side: order.side,
                quantity: sizing.contracts,
                price: formatDollars(best.polymarketPrice),
              });
            } else {
              executionErrors.push(
                'Could not find Polymarket token ID for this market.'
              );
            }
          } catch (e: unknown) {
            executionErrors.push(
              `Polymarket order failed: ${e instanceof Error ? e.message : String(e)}`
            );
          }
        } else if (!state.polymarket) {
          executionErrors.push(
            'Polymarket not authenticated — only Kalshi order placed. Run polymarket_login and retry.'
          );
        }

        return object({
          plan,
          orders,
          execution_errors: executionErrors,
          success: executionErrors.length === 0,
          note:
            executionErrors.length === 0
              ? `Both sides placed! Guaranteed profit of ${formatDollars(sizing.guaranteedProfit)} locked in.`
              : `Partial execution. Review errors.`,
        });
      } catch (e: unknown) {
        return error(
          `quick_arb failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  );
}
