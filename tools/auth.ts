import { z } from 'zod';
import { text, error, object } from 'mcp-use/server';
import type { McpServerInstance, ToolContext } from 'mcp-use/server';
import { KalshiClient } from '../lib/kalshi/client.js';
import { PolymarketClient } from '../lib/polymarket/client.js';
import {
  getSession,
  setKalshiSession,
  setPolymarketSession,
} from '../lib/utils/session.js';
import { getSessionId } from '../lib/utils/ctx.js';
import { formatDollars } from '../lib/utils/normalize.js';

export function registerAuthTools(server: McpServerInstance) {
  server.tool(
    {
      name: 'kalshi_login',
      description:
        'Authenticate with Kalshi using your API key and RSA private key. Get your API key from kalshi.com → Settings → API Keys.',
      schema: z.object({
        api_key_id: z
          .string()
          .describe('Your Kalshi API key ID (from Settings → API Keys)'),
        private_key_pem: z
          .string()
          .describe(
            'Your RSA private key in PEM format (starts with -----BEGIN RSA PRIVATE KEY-----)'
          ),
      }),
    },
    async ({ api_key_id, private_key_pem }, ctx: ToolContext) => {
      try {
        const client = new KalshiClient(api_key_id, private_key_pem);
        // Verify auth by fetching balance
        const balance = await client.getBalance();
        setKalshiSession(getSessionId(ctx), api_key_id, client);

        return text(
          `Kalshi authenticated successfully.\nBalance: ${formatDollars(balance.balance / 100)}`
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return error(`Kalshi authentication failed: ${msg}`);
      }
    }
  );

  server.tool(
    {
      name: 'polymarket_login',
      description:
        'Authenticate with Polymarket using your Ethereum wallet private key. Derives L2 API credentials for trading.',
      schema: z.object({
        private_key: z
          .string()
          .describe(
            'Your Ethereum wallet private key (hex, with or without 0x prefix)'
          ),
        funder_address: z
          .string()
          .optional()
          .describe(
            'Your Polymarket proxy wallet address (from polymarket.com/settings). Required if using a proxy wallet.'
          ),
      }),
    },
    async ({ private_key, funder_address }, ctx: ToolContext) => {
      try {
        const client = new PolymarketClient(
          private_key,
          undefined,
          funder_address
        );

        // Derive L2 API credentials
        const creds = await client.deriveCredentials();
        setPolymarketSession(getSessionId(ctx), client.address, client);

        return text(
          `Polymarket authenticated successfully.\nWallet: ${client.address}\nAPI credentials derived.`
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return error(`Polymarket authentication failed: ${msg}`);
      }
    }
  );

  server.tool(
    {
      name: 'auth_status',
      description:
        'Check which prediction market platforms are currently authenticated.',
      schema: z.object({}),
    },
    async (_params, ctx: ToolContext) => {
      const state = getSession(getSessionId(ctx));
      const result: Record<string, unknown> = {};

      if (state.kalshi) {
        try {
          const balance = await state.kalshi.client.getBalance();
          result.kalshi = {
            authenticated: true,
            api_key_id: state.kalshi.apiKeyId,
            balance: formatDollars(balance.balance / 100),
          };
        } catch {
          result.kalshi = {
            authenticated: true,
            api_key_id: state.kalshi.apiKeyId,
            balance: 'unable to fetch',
          };
        }
      } else {
        result.kalshi = { authenticated: false };
      }

      if (state.polymarket) {
        result.polymarket = {
          authenticated: true,
          address: state.polymarket.address,
        };
      } else {
        result.polymarket = { authenticated: false };
      }

      return object(result);
    }
  );
}
