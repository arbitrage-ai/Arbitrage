const BASE_URL = 'https://api.domeapi.io/v1';

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
  side_a: { id: string; label: string };
  side_b: { id: string; label: string };
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
  winning_outcome: { id: string; label: string } | null;
  market_status: 'open' | 'closed';
}

export class DomeClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, params?: Record<string, string | string[]>): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        if (Array.isArray(val)) {
          for (const v of val) url.searchParams.append(key, v);
        } else if (val !== undefined && val !== '') {
          url.searchParams.set(key, val);
        }
      }
    }
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Dome API ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
  }

  async searchPolymarketMarkets(opts: {
    search?: string;
    tags?: string[];
    status?: 'open' | 'closed';
    min_volume?: number;
    limit?: number;
  }): Promise<{ markets: DomePolymarketMarket[]; total: number }> {
    const params: Record<string, string | string[]> = {};
    if (opts.search) params.search = opts.search;
    if (opts.tags) params.tags = opts.tags;
    if (opts.status) params.status = opts.status;
    if (opts.min_volume) params.min_volume = String(opts.min_volume);
    if (opts.limit) params.limit = String(opts.limit);
    const data = await this.request<{ markets: DomePolymarketMarket[]; pagination: { total: number } }>(
      '/polymarket/markets', params
    );
    return { markets: data.markets || [], total: data.pagination?.total || 0 };
  }

  async searchKalshiMarkets(opts: {
    search?: string;
    status?: 'open' | 'closed';
    min_volume?: number;
    limit?: number;
  }): Promise<{ markets: DomeKalshiMarket[]; total: number }> {
    const params: Record<string, string | string[]> = {};
    if (opts.search) params.search = opts.search;
    if (opts.status) params.status = opts.status;
    if (opts.min_volume) params.min_volume = String(opts.min_volume);
    if (opts.limit) params.limit = String(opts.limit);
    const data = await this.request<{ markets: DomeKalshiMarket[]; pagination: { total: number } }>(
      '/kalshi/markets', params
    );
    return { markets: data.markets || [], total: data.pagination?.total || 0 };
  }

  async getMatchingSportsMarkets(opts: {
    polymarket_slugs?: string[];
    kalshi_event_tickers?: string[];
  }): Promise<DomeMatchingMarkets> {
    const params: Record<string, string | string[]> = {};
    if (opts.polymarket_slugs?.length) params.polymarket_market_slug = opts.polymarket_slugs;
    if (opts.kalshi_event_tickers?.length) params.kalshi_event_ticker = opts.kalshi_event_tickers;
    return this.request<DomeMatchingMarkets>('/matching-markets/sports', params);
  }

  async getPolymarketPositions(walletAddress: string): Promise<{
    positions: DomePosition[];
    has_more: boolean;
  }> {
    const data = await this.request<{
      positions: DomePosition[];
      pagination: { has_more: boolean };
    }>(`/polymarket/positions/wallet/${walletAddress}`);
    return { positions: data.positions || [], has_more: data.pagination?.has_more || false };
  }

  async getPolymarketMarketPrice(tokenId: string): Promise<{ price: number; at_time: number }> {
    return this.request(`/polymarket/market-price/${tokenId}`);
  }

  async getKalshiMarketPrice(ticker: string): Promise<{
    yes: { price: number; at_time: number };
    no: { price: number; at_time: number };
  }> {
    return this.request(`/kalshi/market-price/${ticker}`);
  }

  async getWalletPnl(walletAddress: string, granularity: 'day' | 'week' | 'month' | 'year' | 'all' = 'all'): Promise<{
    pnl_over_time: Array<{ timestamp: number; pnl_to_date: number }>;
  }> {
    return this.request(`/polymarket/wallet/pnl/${walletAddress}`, { granularity });
  }
}
