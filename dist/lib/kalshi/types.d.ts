export interface KalshiMarket {
    ticker: string;
    event_ticker: string;
    title: string;
    subtitle: string;
    status: 'unopened' | 'open' | 'closed' | 'settled';
    yes_bid: number;
    yes_ask: number;
    no_bid: number;
    no_ask: number;
    last_price: number;
    volume: number;
    open_interest: number;
    close_time: string;
    expiration_time: string;
    result?: 'yes' | 'no' | 'all_no' | 'all_yes';
    rules_primary: string;
    settlement_timer_seconds: number;
}
export interface KalshiOrderbook {
    yes: [number, number][];
    no: [number, number][];
}
export interface KalshiOrder {
    order_id: string;
    ticker: string;
    action: 'buy' | 'sell';
    side: 'yes' | 'no';
    type: 'limit' | 'market';
    status: string;
    yes_price: number;
    no_price: number;
    count: number;
    remaining_count: number;
    created_time: string;
}
export interface KalshiPosition {
    ticker: string;
    event_ticker: string;
    market_exposure: number;
    position: number;
    realized_pnl: number;
    resting_orders_count: number;
    total_traded: number;
    fees_paid: number;
}
export interface KalshiBalance {
    balance: number;
    payout: number;
}
export interface KalshiOrderInput {
    ticker: string;
    action: 'buy' | 'sell';
    side: 'yes' | 'no';
    type: 'limit' | 'market';
    count: number;
    yes_price?: number;
    no_price?: number;
    client_order_id?: string;
}
export interface KalshiEvent {
    event_ticker: string;
    title: string;
    category: string;
    markets: KalshiMarket[];
}
