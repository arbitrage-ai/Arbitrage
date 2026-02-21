export interface KalshiBalance {
  balance: number; // in cents
  payout: number;
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
