export interface PolymarketConfig {
  apiKey?: string;
  baseUrl?: string;
}

export interface PolymarketMarket {
  condition_id: string;
  question: string;
  description: string;
  category: string;
  end_date_iso: string;
  active: boolean;
  closed: boolean;
  tokens: PolymarketToken[];
  volume: number;
  liquidity: number;
  slug: string;
}

export interface PolymarketToken {
  token_id: string;
  outcome: string;
  price: number;
  winner?: boolean;
}

export interface PolymarketPosition {
  condition_id: string;
  title: string;
  outcome: string;
  size: number;
  average_price: number;
  current_price: number;
  pnl: number;
  market_slug: string;
}

export interface PolymarketPortfolio {
  total_value: number;
  total_pnl: number;
  positions: PolymarketPosition[];
}

export interface PolymarketOrder {
  id: string;
  condition_id: string;
  outcome: string;
  side: "BUY" | "SELL";
  size: number;
  price: number;
  status: string;
  created_at: string;
}

export interface PolymarketTradeRequest {
  condition_id: string;
  outcome: string;
  side: "BUY" | "SELL";
  size: number;
  price?: number;
}

export interface PolymarketComment {
  id: string;
  author: string;
  content: string;
  created_at: string;
  likes: number;
}

export class PolymarketClient {
  private baseUrl: string;
  private clobBaseUrl: string;
  private apiKey: string | undefined;

  constructor(config: PolymarketConfig = {}) {
    this.baseUrl =
      config.baseUrl ??
      process.env.POLYMARKET_API_URL ??
      "https://gamma-api.polymarket.com";
    this.clobBaseUrl =
      process.env.POLYMARKET_CLOB_URL ?? "https://clob.polymarket.com";
    this.apiKey = config.apiKey ?? process.env.POLYMARKET_API_KEY;
  }

  private async request<T>(
    baseUrl: string,
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(this.apiKey ? { "POLY_API_KEY": this.apiKey } : {}),
      ...((options.headers as Record<string, string>) ?? {}),
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `Polymarket API error (${response.status}): ${errorText}`
      );
    }

    return response.json() as Promise<T>;
  }

  async getMarkets(query?: string, limit = 20): Promise<PolymarketMarket[]> {
    const params = new URLSearchParams({ limit: String(limit), active: "true" });
    if (query) {
      params.set("title", query);
    }
    return this.request<PolymarketMarket[]>(
      this.baseUrl,
      `/markets?${params.toString()}`
    );
  }

  async getMarket(conditionId: string): Promise<PolymarketMarket> {
    return this.request<PolymarketMarket>(
      this.baseUrl,
      `/markets/${conditionId}`
    );
  }

  async getMarketBySlug(slug: string): Promise<PolymarketMarket> {
    const markets = await this.request<PolymarketMarket[]>(
      this.baseUrl,
      `/markets?slug=${slug}`
    );
    if (!markets.length) {
      throw new Error(`Market not found: ${slug}`);
    }
    return markets[0];
  }

  async getMarketOdds(conditionId: string): Promise<PolymarketToken[]> {
    const market = await this.getMarket(conditionId);
    return market.tokens;
  }

  async getPortfolio(): Promise<PolymarketPortfolio> {
    if (!this.apiKey) {
      throw new Error(
        "POLYMARKET_API_KEY is required. Set it in your environment variables."
      );
    }
    const positions = await this.getPositions();
    const totalValue = positions.reduce(
      (sum, p) => sum + p.current_price * p.size,
      0
    );
    const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
    return { total_value: totalValue, total_pnl: totalPnl, positions };
  }

  async getPositions(): Promise<PolymarketPosition[]> {
    if (!this.apiKey) {
      throw new Error(
        "POLYMARKET_API_KEY is required. Set it in your environment variables."
      );
    }
    const data = await this.request<{
      positions: Array<{
        conditionId: string;
        title: string;
        outcome: string;
        size: number;
        avgPrice: number;
        curPrice: number;
        pnl: number;
        slug: string;
      }>;
    }>(this.clobBaseUrl, "/positions");

    return (data.positions ?? []).map((p) => ({
      condition_id: p.conditionId,
      title: p.title,
      outcome: p.outcome,
      size: p.size,
      average_price: p.avgPrice,
      current_price: p.curPrice,
      pnl: p.pnl,
      market_slug: p.slug,
    }));
  }

  async placeTrade(trade: PolymarketTradeRequest): Promise<PolymarketOrder> {
    if (!this.apiKey) {
      throw new Error(
        "POLYMARKET_API_KEY is required. Set it in your environment variables."
      );
    }
    const data = await this.request<{ order: PolymarketOrder }>(
      this.clobBaseUrl,
      "/orders",
      {
        method: "POST",
        body: JSON.stringify({
          tokenID: trade.condition_id,
          outcome: trade.outcome,
          side: trade.side,
          size: trade.size,
          ...(trade.price ? { price: trade.price } : {}),
        }),
      }
    );
    return data.order;
  }

  async getOrderHistory(): Promise<PolymarketOrder[]> {
    if (!this.apiKey) {
      throw new Error(
        "POLYMARKET_API_KEY is required. Set it in your environment variables."
      );
    }
    const data = await this.request<{ orders: PolymarketOrder[] }>(
      this.clobBaseUrl,
      "/orders"
    );
    return data.orders ?? [];
  }

  async getComments(conditionId: string): Promise<PolymarketComment[]> {
    const data = await this.request<PolymarketComment[]>(
      this.baseUrl,
      `/markets/${conditionId}/comments`
    );
    return data ?? [];
  }
}
