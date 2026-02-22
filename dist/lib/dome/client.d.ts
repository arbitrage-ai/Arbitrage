export interface DomePolymarketMarket {
    market_slug: string;
    event_slug: string | null;
    condition_id: string;
    title: string;
    start_time: number;
    end_time: number;
    close_time: number | null;
    tags: string[];
    volume_total: number;
    volume_1_week: number;
    volume_1_month: number;
    status: 'open' | 'closed';
    description: string | null;
    side_a: {
        id: string;
        label: string;
    };
    side_b: {
        id: string;
        label: string;
    };
    winning_side: string | null;
    image: string;
}
export interface DomeKalshiMarket {
    event_ticker: string;
    market_ticker: string;
    title: string;
    start_time: number;
    end_time: number;
    close_time: number | null;
    status: 'open' | 'closed';
    last_price: number;
    volume: number;
    volume_24h: number;
    result: string | null;
}
export interface DomeMatchingMarkets {
    markets: Record<string, Array<{
        platform: 'KALSHI' | 'POLYMARKET';
        event_ticker?: string;
        market_tickers?: string[];
        market_slug?: string;
        token_ids?: string[];
    }>>;
}
export interface DomePosition {
    wallet: string;
    token_id: string;
    condition_id: string;
    title: string;
    shares: number;
    shares_normalized: number;
    redeemable: boolean;
    market_slug: string;
    event_slug: string;
    label: string;
    winning_outcome: {
        id: string;
        label: string;
    } | null;
    market_status: 'open' | 'closed';
}
export declare class DomeClient {
    private apiKey;
    constructor(apiKey: string);
    private request;
    searchPolymarketMarkets(opts: {
        search?: string;
        tags?: string[];
        status?: 'open' | 'closed';
        min_volume?: number;
        limit?: number;
    }): Promise<{
        markets: DomePolymarketMarket[];
        total: number;
    }>;
    searchKalshiMarkets(opts: {
        search?: string;
        status?: 'open' | 'closed';
        min_volume?: number;
        limit?: number;
    }): Promise<{
        markets: DomeKalshiMarket[];
        total: number;
    }>;
    getMatchingSportsMarkets(opts: {
        polymarket_slugs?: string[];
        kalshi_event_tickers?: string[];
    }): Promise<DomeMatchingMarkets>;
    getPolymarketPositions(walletAddress: string): Promise<{
        positions: DomePosition[];
        has_more: boolean;
    }>;
    getPolymarketMarketPrice(tokenId: string): Promise<{
        price: number;
        at_time: number;
    }>;
    getKalshiMarketPrice(ticker: string): Promise<{
        yes: {
            price: number;
            at_time: number;
        };
        no: {
            price: number;
            at_time: number;
        };
    }>;
    getWalletPnl(walletAddress: string, granularity?: 'day' | 'week' | 'month' | 'year' | 'all'): Promise<{
        pnl_over_time: Array<{
            timestamp: number;
            pnl_to_date: number;
        }>;
    }>;
}
