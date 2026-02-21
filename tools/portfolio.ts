import { z } from 'zod';
import { text, error, object, markdown } from 'mcp-use/server';
import type { McpServerInstance, ToolContext } from 'mcp-use/server';
import { getSession } from '../lib/utils/session.js';
import { getSessionId } from '../lib/utils/ctx.js';
import {
  kalshiCentsToDecimal,
  formatDollars,
  formatPnl,
} from '../lib/utils/normalize.js';

export function registerPortfolioTools(server: McpServerInstance) {
  server.tool(
    {
      name: 'get_balance',
      description:
        'Get account balance on Kalshi, Polymarket, or both platforms.',
      schema: z.object({
        platform: z
          .enum(['kalshi', 'polymarket', 'both'])
          .default('both')
          .describe('Which platform to check balance for'),
      }),
    },
    async ({ platform }, ctx: ToolContext) => {
      const state = getSession(getSessionId(ctx));
      const result: Record<string, unknown> = {};

      if ((platform === 'kalshi' || platform === 'both') && state.kalshi) {
        try {
          const balance = await state.kalshi.client.getBalance();
          result.kalshi = {
            balance: formatDollars(balance.balance / 100),
            balance_cents: balance.balance,
          };
        } catch (e: unknown) {
          result.kalshi = { error: e instanceof Error ? e.message : String(e) };
        }
      } else if (platform === 'kalshi' || platform === 'both') {
        result.kalshi = { error: 'Not authenticated. Run kalshi_login first.' };
      }

      if (
        (platform === 'polymarket' || platform === 'both') &&
        state.polymarket
      ) {
        try {
          const { usdc, usdcNative } = await state.polymarket.client.getUSDCBalance();
          const total = usdc + usdcNative;
          result.polymarket = {
            address: state.polymarket.address,
            balance: formatDollars(total),
            usdc_e: formatDollars(usdc),
            usdc_native: formatDollars(usdcNative),
          };
        } catch (e: unknown) {
          result.polymarket = {
            address: state.polymarket.address,
            balance_error: e instanceof Error ? e.message : String(e),
          };
        }
      } else if (platform === 'polymarket' || platform === 'both') {
        result.polymarket = {
          error: 'Not authenticated. Run polymarket_login first.',
        };
      }

      return object(result);
    }
  );

  server.tool(
    {
      name: 'get_positions',
      description:
        'Get open positions and P&L across Kalshi and/or Polymarket.',
      schema: z.object({
        platform: z
          .enum(['kalshi', 'polymarket', 'both'])
          .default('both')
          .describe('Which platform to get positions from'),
      }),
    },
    async ({ platform }, ctx: ToolContext) => {
      const state = getSession(getSessionId(ctx));
      const positions: unknown[] = [];

      if ((platform === 'kalshi' || platform === 'both') && state.kalshi) {
        try {
          const { market_positions } =
            await state.kalshi.client.getPositions();
          for (const pos of market_positions) {
            positions.push({
              platform: 'kalshi',
              ticker: pos.ticker,
              event: pos.event_ticker,
              position: pos.position,
              exposure: formatDollars(pos.market_exposure / 100),
              realized_pnl: formatPnl(pos.realized_pnl / 100),
              fees_paid: formatDollars(pos.fees_paid / 100),
              resting_orders: pos.resting_orders_count,
            });
          }
        } catch (e: unknown) {
          positions.push({
            platform: 'kalshi',
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      if (
        (platform === 'polymarket' || platform === 'both') &&
        state.polymarket
      ) {
        try {
          const polyPositions =
            await state.polymarket.client.getPositions();
          for (const pos of polyPositions) {
            positions.push({
              platform: 'polymarket',
              market: pos.market,
              outcome: pos.outcome,
              size: pos.size,
              avg_price: pos.avg_price,
              current_price: pos.cur_price,
              pnl: formatPnl(pos.pnl),
            });
          }
        } catch (e: unknown) {
          positions.push({
            platform: 'polymarket',
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      if (positions.length === 0) {
        return text(
          'No positions found. Make sure you are authenticated on at least one platform.'
        );
      }

      return object({ positions, count: positions.length });
    }
  );

  server.tool(
    {
      name: 'portfolio_summary',
      description:
        'Get a unified portfolio overview across both Kalshi and Polymarket with total value, P&L, and risk exposure.',
      schema: z.object({}),
    },
    async (_params, ctx: ToolContext) => {
      const state = getSession(getSessionId(ctx));
      const summary: Record<string, unknown> = {
        platforms: {},
        total_positions: 0,
      };

      if (state.kalshi) {
        try {
          const balance = await state.kalshi.client.getBalance();
          const { market_positions } =
            await state.kalshi.client.getPositions();
          const totalExposure = market_positions.reduce(
            (sum, p) => sum + Math.abs(p.market_exposure),
            0
          );
          const totalPnl = market_positions.reduce(
            (sum, p) => sum + p.realized_pnl,
            0
          );

          summary.platforms = {
            ...(summary.platforms as Record<string, unknown>),
            kalshi: {
              balance: formatDollars(balance.balance / 100),
              open_positions: market_positions.length,
              total_exposure: formatDollars(totalExposure / 100),
              realized_pnl: formatPnl(totalPnl / 100),
            },
          };
          summary.total_positions =
            (summary.total_positions as number) + market_positions.length;
        } catch (e: unknown) {
          (summary.platforms as Record<string, unknown>).kalshi = {
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }

      if (state.polymarket) {
        try {
          const [positions, balanceData] = await Promise.all([
            state.polymarket.client.getPositions(),
            state.polymarket.client.getUSDCBalance().catch(() => ({ usdc: 0, usdcNative: 0 })),
          ]);
          const totalPnl = positions.reduce((sum, p) => sum + (p.pnl || 0), 0);
          const totalBalance = balanceData.usdc + balanceData.usdcNative;

          summary.platforms = {
            ...(summary.platforms as Record<string, unknown>),
            polymarket: {
              address: state.polymarket.address,
              balance: formatDollars(totalBalance),
              open_positions: positions.length,
              total_pnl: formatPnl(totalPnl),
            },
          };
          summary.total_positions =
            (summary.total_positions as number) + positions.length;
        } catch (e: unknown) {
          (summary.platforms as Record<string, unknown>).polymarket = {
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }

      if (!state.kalshi && !state.polymarket) {
        return text(
          'Not authenticated on any platform. Use kalshi_login or polymarket_login first.'
        );
      }

      return object(summary);
    }
  );
}
