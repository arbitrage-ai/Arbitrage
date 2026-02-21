export interface PolymarketEvent {
    id: string;
    title: string;
    slug: string;
    description: string;
    active: boolean;
    closed: boolean;
    markets: PolymarketMarket[];
    volume: number;
    liquidity: number;
    start_date: string;
    end_date: string;
    tags: PolymarketTag[];
}
export interface PolymarketMarket {
    id: string;
    question: string;
    slug: string;
    condition_id: string;
    outcomes: string[];
    outcome_prices: string[];
    clob_token_ids: string[];
    volume: number;
    volume_24hr: number;
    liquidity: number;
    active: boolean;
    closed: boolean;
    end_date: string;
    description: string;
    tags: PolymarketTag[];
    resolution_source: string;
}
export interface PolymarketTag {
    id: string;
    label: string;
    slug: string;
}
export interface PolymarketOrderbook {
    bids: PolymarketOrderbookEntry[];
    asks: PolymarketOrderbookEntry[];
    market: string;
    asset_id: string;
    hash: string;
    timestamp: string;
}
export interface PolymarketOrderbookEntry {
    price: string;
    size: string;
}
export interface PolymarketPosition {
    asset: string;
    condition_id: string;
    size: number;
    avg_price: number;
    cur_price: number;
    pnl: number;
    event: string;
    market: string;
    outcome: string;
}
export interface PolymarketOrder {
    id: string;
    status: string;
    market: string;
    asset_id: string;
    side: 'BUY' | 'SELL';
    original_size: string;
    size_matched: string;
    price: string;
    outcome: string;
    created_at: number;
}
export interface L2Credentials {
    apiKey: string;
    secret: string;
    passphrase: string;
}
export interface PolymarketOrderInput {
    tokenId: string;
    price: number;
    size: number;
    side: 'BUY' | 'SELL';
    orderType?: 'GTC' | 'FOK' | 'GTD';
}
