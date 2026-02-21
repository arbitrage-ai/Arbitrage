import type { KalshiClient } from './kalshi/client.js';
import type { PolymarketClient } from './polymarket/client.js';
import type { ToolContext } from 'mcp-use/server';

export interface SessionState {
  kalshi?: { apiKeyId: string; client: KalshiClient };
  polymarket?: { address: string; client: PolymarketClient };
}

const sessions = new Map<string, SessionState>();
const lastSeen = new Map<string, number>();
const TTL = 2 * 60 * 60 * 1000; // 2 hours

setInterval(() => {
  const cutoff = Date.now() - TTL;
  for (const [id, ts] of lastSeen) {
    if (ts < cutoff) {
      sessions.delete(id);
      lastSeen.delete(id);
    }
  }
}, 15 * 60 * 1000).unref();

function touch(id: string) {
  lastSeen.set(id, Date.now());
}

export function getSessionId(ctx: ToolContext): string {
  return (
    (ctx as any).req?.header?.('mcp-session-id') ||
    (ctx as any).req?.headers?.get?.('mcp-session-id') ||
    (ctx as any).sessionId ||
    'default'
  ) as string;
}

export function getSession(sessionId: string): SessionState {
  touch(sessionId);
  if (!sessions.has(sessionId)) sessions.set(sessionId, {});
  return sessions.get(sessionId)!;
}

export function setKalshiSession(sessionId: string, apiKeyId: string, client: KalshiClient) {
  touch(sessionId);
  getSession(sessionId).kalshi = { apiKeyId, client };
}

export function setPolymarketSession(sessionId: string, address: string, client: PolymarketClient) {
  touch(sessionId);
  getSession(sessionId).polymarket = { address, client };
}

export function clearKalshiSession(sessionId: string) {
  const s = getSession(sessionId);
  delete s.kalshi;
}

export function clearPolymarketSession(sessionId: string) {
  const s = getSession(sessionId);
  delete s.polymarket;
}
