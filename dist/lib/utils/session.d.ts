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
export declare function getSession(_sessionId: string): SessionState;
export declare function setKalshiSession(_sessionId: string, apiKeyId: string, privateKeyPem: string): void;
export declare function setPolymarketSession(_sessionId: string, privateKey: string, creds: L2Credentials, funderAddress?: string): void;
export declare function clearKalshiSession(_sessionId: string): void;
export declare function clearPolymarketSession(_sessionId: string): void;
export declare function clearSession(_sessionId: string): void;
