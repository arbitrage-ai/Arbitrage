import type { KalshiMarket, KalshiOrderbook, KalshiOrder, KalshiPosition, KalshiBalance, KalshiOrderInput, KalshiEvent } from './types.js';
export declare class KalshiClient {
    private apiKeyId;
    private privateKey;
    constructor(apiKeyId: string, privateKeyPem: string);
    private sign;
    private request;
    getBalance(): Promise<KalshiBalance>;
    getPositions(params?: {
        status?: string;
        limit?: number;
        cursor?: string;
    }): Promise<{
        market_positions: KalshiPosition[];
        cursor: string;
    }>;
    getMarkets(params?: {
        status?: string;
        series_ticker?: string;
        limit?: number;
        cursor?: string;
        event_ticker?: string;
    }): Promise<{
        markets: KalshiMarket[];
        cursor: string;
    }>;
    getMarket(ticker: string): Promise<{
        market: KalshiMarket;
    }>;
    getOrderbook(ticker: string): Promise<{
        orderbook: KalshiOrderbook;
    }>;
    getEvents(params?: {
        status?: string;
        series_ticker?: string;
        limit?: number;
        cursor?: string;
    }): Promise<{
        events: KalshiEvent[];
        cursor: string;
    }>;
    createOrder(order: KalshiOrderInput): Promise<{
        order: KalshiOrder;
    }>;
    cancelOrder(orderId: string): Promise<void>;
    getOrders(params?: {
        ticker?: string;
        status?: string;
    }): Promise<{
        orders: KalshiOrder[];
    }>;
}
