import type { PolymarketEvent, PolymarketMarket, PolymarketOrderbook, PolymarketPosition, PolymarketOrder, L2Credentials, PolymarketOrderInput } from './types.js';
export declare class PolymarketClient {
    private wallet;
    private creds?;
    private funderAddress?;
    constructor(privateKey: string, creds?: L2Credentials, funderAddress?: string);
    get address(): string;
    deriveCredentials(): Promise<L2Credentials>;
    setCreds(creds: L2Credentials): void;
    private l2Sign;
    private clobRequest;
    searchEvents(params?: {
        limit?: number;
        offset?: number;
        active?: boolean;
        closed?: boolean;
        order?: string;
        ascending?: boolean;
        tag_id?: number;
    }): Promise<PolymarketEvent[]>;
    searchMarkets(params?: {
        limit?: number;
        offset?: number;
        active?: boolean;
        closed?: boolean;
        tag_id?: number;
        slug?: string;
    }): Promise<PolymarketMarket[]>;
    getMarket(idOrSlug: string): Promise<PolymarketMarket>;
    searchText(query: string): Promise<unknown[]>;
    getPrice(tokenId: string, side?: 'BUY' | 'SELL'): Promise<{
        price: string;
    }>;
    getMidpoint(tokenId: string): Promise<{
        mid: string;
    }>;
    getOrderbook(tokenId: string): Promise<PolymarketOrderbook>;
    placeOrder(order: PolymarketOrderInput): Promise<PolymarketOrder>;
    cancelOrder(orderId: string): Promise<void>;
    cancelAll(): Promise<void>;
    getOpenOrders(): Promise<PolymarketOrder[]>;
    getPositions(address?: string, conditionId?: string): Promise<PolymarketPosition[]>;
    getTrades(address?: string, marketId?: string): Promise<unknown[]>;
    getUSDCBalance(address?: string): Promise<{
        usdc: number;
        usdcNative: number;
    }>;
    static parseMarketFields(raw: Record<string, unknown>): {
        outcomes: string[];
        outcomePrices: string[];
        clobTokenIds: string[];
    };
}
