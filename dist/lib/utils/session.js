/**
 * Credential store for single-user deployed server.
 * Credentials persist across HMR reloads via globalThis and are shared
 * across all sessions (handles inspector proxy session ID mismatches).
 */
import { KalshiClient } from '../kalshi/client.js';
import { PolymarketClient } from '../polymarket/client.js';
// Single global credential store that survives HMR reloads
const g = globalThis;
if (!g.__mcpCreds)
    g.__mcpCreds = {};
function hydrateClients(state) {
    if (state.kalshi && !(state.kalshi.client instanceof KalshiClient)) {
        try {
            state.kalshi.client = new KalshiClient(state.kalshi.apiKeyId, state.kalshi.privateKeyPem);
        }
        catch {
            delete state.kalshi;
        }
    }
    if (state.polymarket && !(state.polymarket.client instanceof PolymarketClient)) {
        try {
            const client = new PolymarketClient(state.polymarket.privateKey, state.polymarket.creds, state.polymarket.funderAddress);
            state.polymarket.client = client;
            state.polymarket.address = client.address;
        }
        catch {
            delete state.polymarket;
        }
    }
}
export function getSession(_sessionId) {
    hydrateClients(g.__mcpCreds);
    return g.__mcpCreds;
}
export function setKalshiSession(_sessionId, apiKeyId, privateKeyPem) {
    g.__mcpCreds.kalshi = {
        apiKeyId,
        privateKeyPem,
        client: new KalshiClient(apiKeyId, privateKeyPem),
    };
}
export function setPolymarketSession(_sessionId, privateKey, creds, funderAddress) {
    const client = new PolymarketClient(privateKey, creds, funderAddress);
    g.__mcpCreds.polymarket = {
        privateKey,
        funderAddress,
        creds,
        address: client.address,
        client,
    };
}
export function clearKalshiSession(_sessionId) {
    delete g.__mcpCreds.kalshi;
}
export function clearPolymarketSession(_sessionId) {
    delete g.__mcpCreds.polymarket;
}
export function clearSession(_sessionId) {
    g.__mcpCreds = {};
}
