import { z } from 'zod';
import { text, error, object } from 'mcp-use/server';
import type { McpServerInstance, ToolContext } from 'mcp-use/server';
import { getSession } from '../lib/utils/session.js';
import { getSessionId } from '../lib/utils/ctx.js';
import {
  kalshiCentsToDecimal,
  formatDollars,
  formatPercent,
} from '../lib/utils/normalize.js';

export function registerMarketTools(server: McpServerInstance) {
  server.tool(
    {
      name: 'search_markets',
      description:
        'Search for prediction markets across Kalshi and Polymarket. Supports filtering by sport and platform.',
      schema: z.object({
        query: z
          .string()
          .describe(
            'Search query (e.g., "Lakers vs Celtics", "Super Bowl", "NBA MVP")'
          ),
        platform: z
          .enum(['kalshi', 'polymarket', 'both'])
          .default('both')
          .describe('Which platform to search'),
        limit: z
          .number()
          .default(20)
          .describe('Max results per platform'),
      }),
    },
    async ({ query, platform, limit }, ctx: ToolContext) => {
      const state = getSession(getSessionId(ctx));
      const results: unknown[] = [];
      const queryLower = query.toLowerCase();

      // Search Kalshi
      if (platform === 'kalshi' || platform === 'both') {
        if (state.kalshi) {
          try {
            const { markets } = await state.kalshi.client.getMarkets({
              status: 'open',
              limit: Math.min(limit * 3, 100), // Fetch more to filter
            });

            const matched = markets
              .filter(
                (m) =>
                  m.title.toLowerCase().includes(queryLower) ||
                  m.event_ticker.toLowerCase().includes(queryLower) ||
                  (m.subtitle || '').toLowerCase().includes(queryLower)
              )
              .slice(0, limit);
            for (const m of matched) {
              results.push({
                platform: 'kalshi',
                ticker: m.ticker,
                event: m.event_ticker,
                title: m.title,
                subtitle: m.subtitle,
                yes_price: formatPercent(kalshiCentsToDecimal(m.yes_bid)),
                no_price: formatPercent(kalshiCentsToDecimal(m.no_bid)),
                yes_bid: m.yes_bid,
                no_bid: m.no_bid,
                volume: m.volume,
                status: m.status,
                close_time: m.close_time,
              });
            }
          } catch (e: unknown) {
            results.push({
              platform: 'kalshi',
              error: e instanceof Error ? e.message : String(e),
            });
          }
        } else {
          // Search Kalshi without auth (public market data)
          results.push({
            platform: 'kalshi',
            note: 'Not authenticated. Authenticate with kalshi_login for full market access.',
          });
        }
      }

      // Search Polymarket (Gamma API - no auth needed)
      if (platform === 'polymarket' || platform === 'both') {
        try {
          const polyMarkets = await (
            state.polymarket?.client ||
            new (await import('../lib/polymarket/client.js')).PolymarketClient(
              '0x0000000000000000000000000000000000000000000000000000000000000001'
            )
          ).searchMarkets({
            active: true,
            closed: false,
            limit: Math.min(limit * 3, 100),
          });

          const matched = polyMarkets
            .filter(
              (m) =>
                m.question.toLowerCase().includes(queryLower) ||
                m.slug.toLowerCase().includes(queryLower)
            )
            .slice(0, limit);

          for (const m of matched) {
            const yesPrice = parseFloat(m.outcome_prices?.[0] || '0');
            const noPrice = parseFloat(m.outcome_prices?.[1] || '0');
            results.push({
              platform: 'polymarket',
              id: m.id,
              slug: m.slug,
              question: m.question,
              yes_price: formatPercent(yesPrice),
              no_price: formatPercent(noPrice),
              yes_decimal: yesPrice,
              no_decimal: noPrice,
              volume_24h: m.volume_24hr,
              liquidity: m.liquidity,
              end_date: m.end_date,
              token_ids: m.clob_token_ids,
            });
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

      return object({
        query,
        results,
        count: results.length,
      });
    }
  );

  server.tool(
    {
      name: 'get_market',
      description:
        'Get detailed information about a specific market on Kalshi or Polymarket.',
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
          const { PolymarketClient } = await import(
            '../lib/polymarket/client.js'
          );
          const tempClient = new PolymarketClient(
            '0x0000000000000000000000000000000000000000000000000000000000000001'
          );
          const market = await tempClient.getMarket(market_id);
          return object({
            platform: 'polymarket',
            id: market.id,
            question: market.question,
            slug: market.slug,
            outcomes: market.outcomes,
            outcome_prices: market.outcome_prices,
            token_ids: market.clob_token_ids,
            volume: market.volume,
            volume_24h: market.volume_24hr,
            liquidity: market.liquidity,
            end_date: market.end_date,
            resolution_source: market.resolution_source,
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
      description: 'Get orderbook depth (bids and asks) for a specific market.',
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

          const yesBids = orderbook.yes.map(([price, qty]) => ({
            price: kalshiCentsToDecimal(price),
            quantity: qty,
          }));
          const noBids = orderbook.no.map(([price, qty]) => ({
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
        if (!state.polymarket) {
          return error(
            'Not authenticated on Polymarket. Run polymarket_login first.'
          );
        }
        try {
          const book =
            await state.polymarket.client.getOrderbook(market_id);
          return object({
            platform: 'polymarket',
            token_id: market_id,
            bids: book.bids.slice(0, 10),
            asks: book.asks.slice(0, 10),
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
