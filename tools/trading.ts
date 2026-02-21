import { z } from 'zod';
import { text, error, object } from 'mcp-use/server';
import type { McpServerInstance, ToolContext } from 'mcp-use/server';
import { getSession } from '../lib/utils/session.js';
import { getSessionId } from '../lib/utils/ctx.js';
import { decimalToKalshiCents, formatDollars } from '../lib/utils/normalize.js';

export function registerTradingTools(server: McpServerInstance) {
  server.tool(
    {
      name: 'place_order',
      description:
        'Place a buy or sell order on Kalshi or Polymarket. Use limit orders for better pricing.',
      schema: z.object({
        platform: z
          .enum(['kalshi', 'polymarket'])
          .describe('Which platform to place the order on'),
        market_id: z
          .string()
          .describe(
            'Market identifier: Kalshi ticker or Polymarket token_id (for the specific outcome)'
          ),
        side: z
          .enum(['yes', 'no'])
          .describe('Which outcome to trade'),
        action: z
          .enum(['buy', 'sell'])
          .describe('Buy or sell contracts'),
        quantity: z
          .number()
          .min(1)
          .describe('Number of contracts to trade'),
        price: z
          .number()
          .min(0.01)
          .max(0.99)
          .describe('Limit price as a decimal (0.55 = 55 cents per contract)'),
        order_type: z
          .enum(['limit', 'market'])
          .default('limit')
          .describe('Order type (limit recommended for better fees)'),
      }),
    },
    async ({ platform, market_id, side, action, quantity, price, order_type }, ctx: ToolContext) => {
      if (platform === 'kalshi') {
        const state = getSession(getSessionId(ctx));
        if (!state.kalshi) {
          return error('Not authenticated on Kalshi. Run kalshi_login first.');
        }

        try {
          const priceCents = decimalToKalshiCents(price);
          const orderInput = {
            ticker: market_id,
            action,
            side,
            type: order_type,
            count: quantity,
            ...(side === 'yes'
              ? { yes_price: priceCents }
              : { no_price: priceCents }),
          } as const;

          const { order } = await state.kalshi.client.createOrder(orderInput);
          const orderedCount = order.count;
          const remainingCount = order.remaining_count;
          const filledCount = Math.max(orderedCount - remainingCount, 0);

          return object({
            platform: 'kalshi',
            order_id: order.order_id,
            ticker: order.ticker,
            action: order.action,
            side: order.side,
            type: order.type,
            status: order.status,
            requested_quantity: quantity,
            quantity: orderedCount,
            filled_quantity: filledCount,
            price: formatDollars(price),
            total_cost: formatDollars(price * orderedCount),
            filled_cost: formatDollars(price * filledCount),
            remaining: remainingCount,
          });
        } catch (e: unknown) {
          return error(
            `Kalshi order failed: ${e instanceof Error ? e.message : String(e)}`
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
          const polySide = action === 'buy' ? 'BUY' : 'SELL';
          const order = await state.polymarket.client.placeOrder({
            tokenId: market_id,
            price,
            size: quantity,
            side: polySide,
            orderType: order_type === 'market' ? 'FOK' : 'GTC',
          });

          return object({
            platform: 'polymarket',
            order_id: order.id,
            status: order.status,
            side: order.side,
            price: formatDollars(price),
            size: quantity,
            total_cost: formatDollars(price * quantity),
          });
        } catch (e: unknown) {
          return error(
            `Polymarket order failed: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
    }
  );

  server.tool(
    {
      name: 'cancel_order',
      description: 'Cancel an open order on Kalshi or Polymarket.',
      schema: z.object({
        platform: z
          .enum(['kalshi', 'polymarket'])
          .describe('Which platform the order is on'),
        order_id: z.string().describe('The order ID to cancel'),
      }),
    },
    async ({ platform, order_id }, ctx: ToolContext) => {
      const state = getSession(getSessionId(ctx));

      if (platform === 'kalshi') {
        if (!state.kalshi) {
          return error('Not authenticated on Kalshi. Run kalshi_login first.');
        }
        try {
          await state.kalshi.client.cancelOrder(order_id);
          return text(`Kalshi order ${order_id} cancelled successfully.`);
        } catch (e: unknown) {
          return error(
            `Failed to cancel Kalshi order: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      } else {
        if (!state.polymarket) {
          return error(
            'Not authenticated on Polymarket. Run polymarket_login first.'
          );
        }
        try {
          await state.polymarket.client.cancelOrder(order_id);
          return text(`Polymarket order ${order_id} cancelled successfully.`);
        } catch (e: unknown) {
          return error(
            `Failed to cancel Polymarket order: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
    }
  );
}
