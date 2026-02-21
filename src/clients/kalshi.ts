export interface KalshiConfig {
  apiKey?: string;
  baseUrl?: string;
}

export interface KalshiMarket {
  ticker: string;
  title: string;
  category: string;
  status: string;
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  volume: number;
  open_interest: number;
  expiration_time: string;
  result?: string;
}

export interface KalshiPosition {
  ticker: string;
  title: string;
  side: "yes" | "no";
  quantity: number;
  average_price: number;
  current_price: number;
  pnl: number;
  market_status: string;
}

export interface KalshiPortfolio {
  balance: number;
  portfolio_value: number;
  total_pnl: number;
  positions: KalshiPosition[];
}

export interface KalshiOrder {
  order_id: string;
  ticker: string;
  side: "yes" | "no";
  type: "market" | "limit";
  quantity: number;
  price: number;
  status: string;
  created_at: string;
}

export interface KalshiTradeRequest {
  ticker: string;
  side: "yes" | "no";
  quantity: number;
  type: "market" | "limit";
  price?: number;
}

export class KalshiClient {
  private baseUrl: string;
  private apiKey: string | undefined;

  constructor(config: KalshiConfig = {}) {
    this.baseUrl =
      config.baseUrl ?? process.env.KALSHI_API_URL ?? "https://api.elections.kalshi.com/trade-api/v2";
    this.apiKey = config.apiKey ?? process.env.KALSHI_API_KEY;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      ...((options.headers as Record<string, string>) ?? {}),
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `Kalshi API error (${response.status}): ${errorText}`
      );
    }

    return response.json() as Promise<T>;
  }

  async getPortfolio(): Promise<KalshiPortfolio> {
    if (!this.apiKey) {
      throw new Error(
        "KALSHI_API_KEY is required. Set it in your environment variables."
      );
    }
    const balance = await this.request<{ balance: number }>("/portfolio/balance");
    const positions = await this.getPositions();
    const portfolioValue = positions.reduce(
      (sum, p) => sum + p.current_price * p.quantity,
      0
    );
    const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
    return {
      balance: balance.balance,
      portfolio_value: portfolioValue,
      total_pnl: totalPnl,
      positions,
    };
  }

  async getPositions(): Promise<KalshiPosition[]> {
    if (!this.apiKey) {
      throw new Error(
        "KALSHI_API_KEY is required. Set it in your environment variables."
      );
    }
    const data = await this.request<{
      market_positions: Array<{
        ticker: string;
        title?: string;
        position: number;
        market_outcome: string;
        average_price: number;
        resting_orders_count: number;
      }>;
    }>("/portfolio/positions");

    return (data.market_positions ?? []).map((p) => ({
      ticker: p.ticker,
      title: p.title ?? p.ticker,
      side: p.position > 0 ? ("yes" as const) : ("no" as const),
      quantity: Math.abs(p.position),
      average_price: p.average_price,
      current_price: p.average_price,
      pnl: 0,
      market_status: p.market_outcome,
    }));
  }

  async getMarketOdds(ticker: string): Promise<KalshiMarket> {
    const data = await this.request<{ market: KalshiMarket }>(
      `/markets/${ticker}`
    );
    return data.market;
  }

  async searchMarkets(query: string, limit = 20): Promise<KalshiMarket[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (query) {
      params.set("title", query);
    }
    const data = await this.request<{ markets: KalshiMarket[] }>(
      `/markets?${params.toString()}`
    );
    return data.markets ?? [];
  }

  async getEventMarkets(eventTicker: string): Promise<KalshiMarket[]> {
    const data = await this.request<{ markets: KalshiMarket[] }>(
      `/events/${eventTicker}/markets`
    );
    return data.markets ?? [];
  }

  async placeTrade(trade: KalshiTradeRequest): Promise<KalshiOrder> {
    if (!this.apiKey) {
      throw new Error(
        "KALSHI_API_KEY is required. Set it in your environment variables."
      );
    }
    const data = await this.request<{ order: KalshiOrder }>("/portfolio/orders", {
      method: "POST",
      body: JSON.stringify({
        ticker: trade.ticker,
        action: "buy",
        side: trade.side,
        count: trade.quantity,
        type: trade.type,
        ...(trade.type === "limit" && trade.price
          ? { yes_price: trade.price }
          : {}),
      }),
    });
    return data.order;
  }

  async getOrderHistory(ticker?: string): Promise<KalshiOrder[]> {
    if (!this.apiKey) {
      throw new Error(
        "KALSHI_API_KEY is required. Set it in your environment variables."
      );
    }
    const params = new URLSearchParams();
    if (ticker) params.set("ticker", ticker);
    const data = await this.request<{ orders: KalshiOrder[] }>(
      `/portfolio/orders?${params.toString()}`
    );
    return data.orders ?? [];
  }
}
