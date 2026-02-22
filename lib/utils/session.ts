/**
 * Credential store for single-user deployed server.
 * Credentials persist across HMR reloads via globalThis and are shared
 * across all sessions (handles inspector proxy session ID mismatches).
 */
import { KalshiClient } from '../kalshi/client.js';
import { PolymarketClient } from '../polymarket/client.js';
import type { L2Credentials } from '../polymarket/types.js';

export interface SessionState {
  kalshi?: {
    apiKeyId: string;
    privateKeyPem: string;
    client: KalshiClient;
  };
  polymarket?: {
    privateKey: string;
    address: string;
    funderAddress?: string;
    creds?: L2Credentials;
    client: PolymarketClient;
  };
}

// Single global credential store that survives HMR reloads
const g = globalThis as unknown as { __mcpCreds?: SessionState };
if (!g.__mcpCreds) g.__mcpCreds = {};

function hydrateClients(state: SessionState): void {
  if (state.kalshi && !(state.kalshi.client instanceof KalshiClient)) {
    try {
      state.kalshi.client = new KalshiClient(
        state.kalshi.apiKeyId,
        state.kalshi.privateKeyPem
      );
    } catch {
      delete state.kalshi;
    }
  }

  if (state.polymarket && !(state.polymarket.client instanceof PolymarketClient)) {
    try {
      const client = new PolymarketClient(
        state.polymarket.privateKey,
        state.polymarket.creds,
        state.polymarket.funderAddress
      );
      state.polymarket.client = client;
      state.polymarket.address = client.address;
    } catch {
      delete state.polymarket;
    }
  }
}

export function getSession(_sessionId: string): SessionState {
  hydrateClients(g.__mcpCreds!);
  return g.__mcpCreds!;
}

export function setKalshiSession(
  _sessionId: string,
  apiKeyId: string,
  privateKeyPem: string
): void {
  g.__mcpCreds!.kalshi = {
    apiKeyId,
    privateKeyPem,
    client: new KalshiClient(apiKeyId, privateKeyPem),
  };
}

export function setPolymarketSession(
  _sessionId: string,
  privateKey: string,
  creds: L2Credentials,
  funderAddress?: string
): void {
  const client = new PolymarketClient(privateKey, creds, funderAddress);
  g.__mcpCreds!.polymarket = {
    privateKey,
    funderAddress,
    creds,
    address: client.address,
    client,
  };
}

export function clearKalshiSession(_sessionId: string): void {
  delete g.__mcpCreds!.kalshi;
}

export function clearPolymarketSession(_sessionId: string): void {
  delete g.__mcpCreds!.polymarket;
}

export function clearSession(_sessionId: string): void {
  g.__mcpCreds = {};
}
