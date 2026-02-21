import { z } from 'zod';
import { text, error, widget } from 'mcp-use/server';
import type { McpServerInstance, ToolContext } from 'mcp-use/server';
import { KalshiClient } from '../lib/kalshi/client.js';
import { PolymarketClient } from '../lib/polymarket/client.js';
import {
  getSession,
  getSessionId,
  setKalshiSession,
  setPolymarketSession,
  clearKalshiSession,
  clearPolymarketSession,
} from '../lib/session.js';

export function registerAuthTools(server: McpServerInstance) {
  // ── Kalshi Login ──
  server.tool(
    {
      name: 'kalshi_login',
      description:
        'Login to Kalshi with API key ID and RSA private key. Opens a login form UI.',
      schema: z.object({
        api_key_id: z.string().describe('Kalshi API Key ID'),
        private_key_pem: z
          .string()
          .describe('RSA private key in PEM format'),
      }),
      widget: {
        name: 'login-kalshi',
        invoking: 'Authenticating with Kalshi...',
        invoked: 'Kalshi login complete',
      },
    },
    async ({ api_key_id, private_key_pem }, ctx: ToolContext) => {
      try {
        const client = new KalshiClient(api_key_id, private_key_pem);
        const balance = await client.getBalance();
        const sid = getSessionId(ctx);
        setKalshiSession(sid, api_key_id, client);

        const balanceDollars = `$${(balance.balance / 100).toFixed(2)}`;

        return widget({
          props: {
            success: true,
            platform: 'kalshi',
            account: api_key_id,
            balance: balanceDollars,
          },
          output: text(
            `Kalshi authenticated. Account: ${api_key_id}, Balance: ${balanceDollars}`
          ),
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return widget({
          props: {
            success: false,
            platform: 'kalshi',
            error: msg,
          },
          output: error(`Kalshi login failed: ${msg}`),
        });
      }
    }
  );

  // ── Polymarket Login ──
  server.tool(
    {
      name: 'polymarket_login',
      description:
        'Login to Polymarket with Ethereum wallet private key. Derives L2 API credentials for CLOB access.',
      schema: z.object({
        private_key: z
          .string()
          .describe('Ethereum wallet private key (hex, with or without 0x)'),
        funder_address: z
          .string()
          .optional()
          .describe('Polymarket proxy wallet address (if using proxy)'),
      }),
      widget: {
        name: 'login-polymarket',
        invoking: 'Deriving Polymarket L2 credentials...',
        invoked: 'Polymarket login complete',
      },
    },
    async ({ private_key, funder_address }, ctx: ToolContext) => {
      try {
        const client = new PolymarketClient(private_key, undefined, funder_address);
        await client.deriveCredentials();
        const sid = getSessionId(ctx);
        setPolymarketSession(sid, client.address, client);

        return widget({
          props: {
            success: true,
            platform: 'polymarket',
            address: client.address,
          },
          output: text(
            `Polymarket authenticated. Wallet: ${client.address}`
          ),
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return widget({
          props: {
            success: false,
            platform: 'polymarket',
            error: msg,
          },
          output: error(`Polymarket login failed: ${msg}`),
        });
      }
    }
  );

  // ── Auth Status ──
  server.tool(
    {
      name: 'auth_status',
      description:
        'Check login status for Kalshi and Polymarket. Shows the auth dashboard UI.',
      schema: z.object({}),
      widget: {
        name: 'auth-dashboard',
        invoking: 'Checking auth status...',
        invoked: 'Auth status loaded',
      },
    },
    async (_params, ctx: ToolContext) => {
      const state = getSession(getSessionId(ctx));
      const kalshiStatus: Record<string, unknown> = { authenticated: false };
      const polymarketStatus: Record<string, unknown> = { authenticated: false };

      if (state.kalshi) {
        try {
          const balance = await state.kalshi.client.getBalance();
          kalshiStatus.authenticated = true;
          kalshiStatus.account = state.kalshi.apiKeyId;
          kalshiStatus.balance = `$${(balance.balance / 100).toFixed(2)}`;
        } catch {
          kalshiStatus.authenticated = true;
          kalshiStatus.account = state.kalshi.apiKeyId;
          kalshiStatus.balance = 'unable to fetch';
        }
      }

      if (state.polymarket) {
        polymarketStatus.authenticated = true;
        polymarketStatus.address = state.polymarket.address;
      }

      return widget({
        props: { kalshi: kalshiStatus, polymarket: polymarketStatus },
        output: text(
          `Kalshi: ${kalshiStatus.authenticated ? 'connected' : 'not connected'} | Polymarket: ${polymarketStatus.authenticated ? 'connected' : 'not connected'}`
        ),
      });
    }
  );

  // ── Logout ──
  server.tool(
    {
      name: 'logout',
      description: 'Disconnect from Kalshi, Polymarket, or both.',
      schema: z.object({
        platform: z
          .enum(['kalshi', 'polymarket', 'both'])
          .default('both')
          .describe('Which platform to disconnect from'),
      }),
    },
    async ({ platform }, ctx: ToolContext) => {
      const sid = getSessionId(ctx);
      if (platform === 'kalshi' || platform === 'both') clearKalshiSession(sid);
      if (platform === 'polymarket' || platform === 'both') clearPolymarketSession(sid);
      return text(`Disconnected from ${platform}.`);
    }
  );
}
