/**
 * Per-session credential store for multi-user deployed server.
 * Each MCP connection gets its own isolated credential namespace.
 * Users must call kalshi_login / polymarket_login in every new session.
 * Credentials are never shared across sessions and expire after idle TTL.
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
export declare function getSession(sessionId: string): SessionState;
export declare function setKalshiSession(sessionId: string, apiKeyId: string, privateKeyPem: string): void;
export declare function setPolymarketSession(sessionId: string, privateKey: string, creds: L2Credentials, funderAddress?: string): void;
export declare function clearKalshiSession(sessionId: string): void;
export declare function clearPolymarketSession(sessionId: string): void;
export declare function clearSession(sessionId: string): void;
