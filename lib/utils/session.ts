/**
 * Per-session credential store for multi-user deployed server.
 * Each MCP connection gets its own isolated credential namespace.
 * Users must call kalshi_login / polymarket_login in every new session.
 * Credentials are never shared across sessions and expire after idle TTL.
 */
import type { KalshiClient } from '../kalshi/client.js';
import type { PolymarketClient } from '../polymarket/client.js';

export interface SessionState {
  kalshi?: {
    apiKeyId: string;
    client: KalshiClient;
  };
  polymarket?: {
    address: string;
    client: PolymarketClient;
  };
}

const sessionMap = new Map<string, SessionState>();
const sessionLastSeen = new Map<string, number>();

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// Evict stale sessions every 15 minutes
setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, ts] of sessionLastSeen) {
    if (ts < cutoff) {
      sessionMap.delete(id);
      sessionLastSeen.delete(id);
    }
  }
}, 15 * 60 * 1000).unref();

function touch(id: string): void {
  sessionLastSeen.set(id, Date.now());
}

export function getSession(sessionId: string): SessionState {
  touch(sessionId);
  if (!sessionMap.has(sessionId)) {
    sessionMap.set(sessionId, {});
  }
  return sessionMap.get(sessionId)!;
}

export function setKalshiSession(
  sessionId: string,
  apiKeyId: string,
  client: KalshiClient
): void {
  touch(sessionId);
  const session = getSession(sessionId);
  session.kalshi = { apiKeyId, client };
}

export function setPolymarketSession(
  sessionId: string,
  address: string,
  client: PolymarketClient
): void {
  touch(sessionId);
  const session = getSession(sessionId);
  session.polymarket = { address, client };
}

export function clearSession(sessionId: string): void {
  sessionMap.delete(sessionId);
  sessionLastSeen.delete(sessionId);
}
