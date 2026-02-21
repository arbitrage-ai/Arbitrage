/**
 * Per-session credential store for multi-user deployed server.
 * Each MCP connection gets its own isolated credential namespace.
 * Users must call kalshi_login / polymarket_login in every new session.
 * Credentials are never shared across sessions and expire after idle TTL.
 */
import { KalshiClient } from '../kalshi/client.js';
import { PolymarketClient } from '../polymarket/client.js';
const sessionMap = new Map();
const sessionLastSeen = new Map();
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
function touch(id) {
    sessionLastSeen.set(id, Date.now());
}
function hydrateClients(session) {
    if (session.kalshi) {
        try {
            session.kalshi.client = new KalshiClient(session.kalshi.apiKeyId, session.kalshi.privateKeyPem);
        }
        catch {
            delete session.kalshi;
        }
    }
    if (session.polymarket) {
        try {
            const client = new PolymarketClient(session.polymarket.privateKey, session.polymarket.creds, session.polymarket.funderAddress);
            session.polymarket.client = client;
            session.polymarket.address = client.address;
        }
        catch {
            delete session.polymarket;
        }
    }
}
export function getSession(sessionId) {
    touch(sessionId);
    if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, {});
    }
    const session = sessionMap.get(sessionId);
    hydrateClients(session);
    return session;
}
export function setKalshiSession(sessionId, apiKeyId, privateKeyPem) {
    touch(sessionId);
    const session = getSession(sessionId);
    session.kalshi = {
        apiKeyId,
        privateKeyPem,
        client: new KalshiClient(apiKeyId, privateKeyPem),
    };
}
export function setPolymarketSession(sessionId, privateKey, creds, funderAddress) {
    touch(sessionId);
    const session = getSession(sessionId);
    const client = new PolymarketClient(privateKey, creds, funderAddress);
    session.polymarket = {
        privateKey,
        funderAddress,
        creds,
        address: client.address,
        client,
    };
}
export function clearKalshiSession(sessionId) {
    const session = getSession(sessionId);
    delete session.kalshi;
}
export function clearPolymarketSession(sessionId) {
    const session = getSession(sessionId);
    delete session.polymarket;
}
export function clearSession(sessionId) {
    sessionMap.delete(sessionId);
    sessionLastSeen.delete(sessionId);
}
