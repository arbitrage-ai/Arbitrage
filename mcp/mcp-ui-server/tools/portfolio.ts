import { z } from 'zod';
import { text, error, widget } from 'mcp-use/server';
import type { McpServerInstance, ToolContext } from 'mcp-use/server';
import { getSession, getSessionId } from '../lib/session.js';

function formatDollars(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatPnl(amount: number): string {
  const sign = amount >= 0 ? '+' : '';
  return `${sign}$${amount.toFixed(2)}`;
}

export function registerPortfolioTools(server: McpServerInstance) {
  // ── Get Portfolio ──
  server.tool(
    {
      name: 'get_portfolio',
      description:
        'Fetch your live portfolio from Kalshi and Polymarket. Shows balances, open positions, and P&L in an interactive dashboard.',
      schema: z.object({
        platform: z
          .enum(['kalshi', 'polymarket', 'both'])
          .default('both')
          .describe('Which platform(s) to show portfolio for'),
      }),
      widget: {
        name: 'portfolio',
        invoking: 'Loading portfolio...',
        invoked: 'Portfolio loaded',
      },
    },
    async ({ platform }, ctx: ToolContext) => {
      const state = getSession(getSessionId(ctx));
      const positions: unknown[] = [];
      let kalshiSummary: Record<string, unknown> | undefined;
      let polymarketSummary: Record<string, unknown> | undefined;

      // ── Kalshi ──
      if ((platform === 'kalshi' || platform === 'both') && state.kalshi) {
        try {
          const balance = await state.kalshi.client.getBalance();
          const { market_positions } = await state.kalshi.client.getPositions();

          const totalExposure = market_positions.reduce(
            (sum, p) => sum + Math.abs(p.market_exposure), 0
          );
          const totalPnl = market_positions.reduce(
            (sum, p) => sum + p.realized_pnl, 0
          );

          kalshiSummary = {
            balance: formatDollars(balance.balance / 100),
            open_positions: market_positions.length,
            total_exposure: formatDollars(totalExposure / 100),
            realized_pnl: formatPnl(totalPnl / 100),
          };

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
          kalshiSummary = { error: e instanceof Error ? e.message : String(e) };
        }
      } else if (platform === 'kalshi' || platform === 'both') {
        kalshiSummary = { error: 'Not logged in. Use kalshi_login first.' };
      }

      // ── Polymarket ──
      if ((platform === 'polymarket' || platform === 'both') && state.polymarket) {
        try {
          const polyPositions = await state.polymarket.client.getPositions();
          const totalPnl = polyPositions.reduce((sum, p) => sum + (p.pnl || 0), 0);

          polymarketSummary = {
            address: state.polymarket.address,
            open_positions: polyPositions.length,
            total_pnl: formatPnl(totalPnl),
          };

          for (const pos of polyPositions) {
            positions.push({
              platform: 'polymarket',
              market: pos.market,
              outcome: pos.outcome,
              size: pos.size,
              avg_price: pos.avg_price,
              current_price: pos.cur_price,
              pnl: formatPnl(pos.pnl || 0),
            });
          }
        } catch (e: unknown) {
          polymarketSummary = { error: e instanceof Error ? e.message : String(e) };
        }
      } else if (platform === 'polymarket' || platform === 'both') {
        polymarketSummary = { error: 'Not logged in. Use polymarket_login first.' };
      }

      if (!state.kalshi && !state.polymarket) {
        return widget({
          props: {
            positions: [],
            kalshi: { error: 'Not logged in' },
            polymarket: { error: 'Not logged in' },
            total_positions: 0,
          },
          output: text('Not authenticated on any platform. Use kalshi_login or polymarket_login first.'),
        });
      }

      const summaryText = [
        kalshiSummary ? `Kalshi: ${kalshiSummary.balance || kalshiSummary.error}` : null,
        polymarketSummary ? `Polymarket: ${polymarketSummary.open_positions || 0} positions` : null,
      ]
        .filter(Boolean)
        .join(' | ');

      return widget({
        props: {
          positions,
          kalshi: kalshiSummary,
          polymarket: polymarketSummary,
          total_positions: positions.length,
        },
        output: text(`Portfolio: ${summaryText} | ${positions.length} total positions`),
      });
    }
  );
}
