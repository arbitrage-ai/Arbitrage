import { z } from 'zod';
import { text, error, object, widget } from 'mcp-use/server';
import type { McpServerInstance, ToolContext } from 'mcp-use/server';
import { getSession } from '../lib/utils/session.js';
import { getSessionId } from '../lib/utils/ctx.js';
import {
  decimalToKalshiCents,
  kalshiCentsToDecimal,
  formatDollars,
} from '../lib/utils/normalize.js';

export function registerTradingTools(server: McpServerInstance) {
  server.tool(
    {
      name: 'place_order',
      description:
        'Place a buy or sell order on Kalshi or Polymarket. ' +
        'WHEN: User wants to trade a specific market after reviewing prices/analysis. ' +
        'REQUIRES: Authentication on the target platform. Market ID from get_market or search_markets results. ' +
        'BEFORE: Confirm the market and price with the user. Use get_orderbook for large orders (>10 contracts) to check depth. ' +
        'Set price=0 for auto-pricing at best ask (instant fill). Supports 1 to 1000+ contracts.',
      widget: {
        name: 'order-entry',
        invoking: 'Placing order...',
        invoked: 'Order placed',
      },
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
          .describe('Number of contracts to trade (1-1000+). No artificial limit.'),
        price: z
          .number()
          .min(0)
          .max(0.99)
          .describe('Limit price as decimal (0.55 = 55¢). Set to 0 for auto-pricing at best ask for instant fill.'),
        order_type: z
          .enum(['limit', 'market'])
          .default('limit')
          .describe('Order type. "market" for instant execution at best available price.'),
      }),
    },
    async ({ platform, market_id, side, action, quantity, price, order_type }, ctx: ToolContext) => {
      if (platform === 'kalshi') {
        const state = getSession(getSessionId(ctx));
        if (!state.kalshi) {
          return error('Not authenticated on Kalshi. Run kalshi_login first.');
        }

        try {
          let effectivePrice = price;
          let autopriced = false;
          let depthWarning: string | undefined;

          // Auto-price at best ask for instant fill
          if (price === 0 || order_type === 'market') {
            const { market } = await state.kalshi.client.getMarket(market_id);
            if (action === 'buy') {
              effectivePrice = kalshiCentsToDecimal(side === 'yes' ? market.yes_ask : market.no_ask);
            } else {
              effectivePrice = kalshiCentsToDecimal(side === 'yes' ? market.yes_bid : market.no_bid);
            }
            autopriced = true;
            if (effectivePrice <= 0) {
              return error(`No ${action === 'buy' ? 'asks' : 'bids'} available for ${side} side. The market may be illiquid.`);
            }
          }

          // Check orderbook depth for large orders
          if (quantity >= 10) {
            try {
              const { orderbook } = await state.kalshi.client.getOrderbook(market_id);
              const levels = side === 'yes' ? orderbook.yes : orderbook.no;
              const totalDepth = levels.reduce((sum, [, qty]) => sum + qty, 0);
              if (quantity > totalDepth * 2) {
                depthWarning = `Orderbook has ~${totalDepth} contracts. Your order (${quantity}) may not fully fill at this price.`;
              }
            } catch { /* orderbook check is non-critical */ }
          }

          const priceCents = decimalToKalshiCents(effectivePrice);
          const orderInput = {
            ticker: market_id,
            action,
            side,
            type: order_type === 'market' ? 'limit' as const : order_type,
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
            autopriced,
            requested_quantity: quantity,
            quantity: orderedCount,
            filled_quantity: filledCount,
            price: formatDollars(effectivePrice),
            total_cost: formatDollars(effectivePrice * orderedCount),
            filled_cost: formatDollars(effectivePrice * filledCount),
            remaining: remainingCount,
            ...(depthWarning ? { depth_warning: depthWarning } : {}),
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

          let effectivePrice = price;
          let autopriced = false;

          if (price === 0 || order_type === 'market') {
            const book = await state.polymarket.client.getOrderbook(market_id);
            if (action === 'buy' && book.asks.length > 0) {
              effectivePrice = parseFloat(book.asks[0].price);
            } else if (action === 'sell' && book.bids.length > 0) {
              effectivePrice = parseFloat(book.bids[0].price);
            }
            autopriced = true;
            if (effectivePrice <= 0) {
              return error('No liquidity on Polymarket for this token.');
            }
          }

          const order = await state.polymarket.client.placeOrder({
            tokenId: market_id,
            price: effectivePrice,
            size: quantity,
            side: polySide,
            orderType: order_type === 'market' ? 'FOK' : 'GTC',
          });

          return object({
            platform: 'polymarket',
            order_id: order.id,
            status: order.status,
            side: order.side,
            autopriced,
            price: formatDollars(effectivePrice),
            size: quantity,
            total_cost: formatDollars(effectivePrice * quantity),
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
      description:
        'Cancel an open order. WHEN: User wants to cancel, or an order is unfilled and conditions have changed. ' +
        'REQUIRES: order_id from place_order or get_positions results.',
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
