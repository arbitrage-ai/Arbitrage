export interface L2Credentials {
  apiKey: string;
  secret: string;
  passphrase: string;
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
