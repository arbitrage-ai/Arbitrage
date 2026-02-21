import { z } from 'zod';
import { access, readFile } from 'node:fs/promises';
import { text, error, object } from 'mcp-use/server';
import type { McpServerInstance, ToolContext } from 'mcp-use/server';
import { KalshiClient } from '../lib/kalshi/client.js';
import { PolymarketClient } from '../lib/polymarket/client.js';
import {
  clearKalshiSession,
  clearPolymarketSession,
  getSession,
  setKalshiSession,
  setPolymarketSession,
} from '../lib/utils/session.js';
import { getSessionId } from '../lib/utils/ctx.js';
import { formatDollars } from '../lib/utils/normalize.js';

async function resolveKalshiPrivateKey(input: string): Promise<string> {
  const trimmed = input.trim().replace(/^['"]|['"]$/g, '');

  const beginMatch = trimmed.match(/-----BEGIN ([A-Z ]+)-----/);
  const endMatch = trimmed.match(/-----END ([A-Z ]+)-----/);
  if (beginMatch && !endMatch) {
    const label = beginMatch[1].trim();
    return `${trimmed}\n-----END ${label}-----`;
  }

  if (trimmed.includes('-----BEGIN')) {
    return trimmed;
  }

  // Support passing a filesystem path instead of raw PEM content.
  try {
    await access(trimmed);
    const content = await readFile(trimmed, 'utf8');
    return content.trim();
  } catch {
    return trimmed;
  }
}

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
      const sessionId = getSessionId(ctx);
      try {
        const resolvedKey = await resolveKalshiPrivateKey(private_key_pem);
        const client = new KalshiClient(api_key_id, resolvedKey);
        // Verify auth by fetching balance
        const balance = await client.getBalance();
        setKalshiSession(sessionId, api_key_id, resolvedKey);

        return text(
          `Kalshi authenticated successfully.\nBalance: ${formatDollars(balance.balance / 100)}`
        );
      } catch (e: unknown) {
        clearKalshiSession(sessionId);
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.startsWith('Private key')) {
          return error(`Kalshi authentication failed: ${msg}`);
        }
        if (msg.includes('DECODER routines::unsupported')) {
          return error(
            'Kalshi authentication failed: invalid private key format. Provide PEM content (including BEGIN/END lines) or a valid path to the PEM file.'
          );
        }
        return error(`Kalshi authentication failed: ${msg}`);
      }
    }
  );

  server.tool(
    {
      name: 'polymarket_login_with_api_key',
      description:
        'Authenticate with Polymarket using existing API credentials (api_key/secret/passphrase) plus wallet private key.',
      schema: z.object({
        private_key: z
          .string()
          .describe(
            'Your Ethereum wallet private key (hex, with or without 0x prefix)'
          ),
        api_key: z
          .string()
          .describe('Polymarket API key (key).'),
        secret: z
          .string()
          .describe('Polymarket API secret (base64).'),
        passphrase: z
          .string()
          .describe('Polymarket API passphrase.'),
        funder_address: z
          .string()
          .optional()
          .describe(
            'Your Polymarket proxy wallet address (from polymarket.com/settings). Required if using a proxy wallet.'
          ),
      }),
    },
    async (
      { private_key, api_key, secret, passphrase, funder_address },
      ctx: ToolContext
    ) => {
      const sessionId = getSessionId(ctx);
      try {
        const normalizedKey = private_key.startsWith('0x')
          ? private_key
          : `0x${private_key}`;

        const client = new PolymarketClient(normalizedKey, undefined, funder_address);
        client.setCreds({
          apiKey: api_key,
          secret,
          passphrase,
        });

        // Some CLOB deployments/modes can return 405 on read-only order endpoints.
        // Persist creds and allow subsequent trading calls to be the final validator.

        setPolymarketSession(
          sessionId,
          normalizedKey,
          {
            apiKey: api_key,
            secret,
            passphrase,
          },
          funder_address
        );

        return text(
          `Polymarket credentials saved successfully.\nWallet: ${client.address}\n` +
            `If needed, validate with get_orderbook or a small dry-run trading flow.`
        );
      } catch (e: unknown) {
        clearPolymarketSession(sessionId);
        const msg = e instanceof Error ? e.message : String(e);
        return error(`Polymarket API-key authentication failed: ${msg}`);
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
