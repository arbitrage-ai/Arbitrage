import crypto from 'node:crypto';
import type {
  KalshiMarket,
  KalshiOrderbook,
  KalshiOrder,
  KalshiPosition,
  KalshiBalance,
  KalshiOrderInput,
  KalshiEvent,
} from './types.js';

const BASE_URL = 'https://api.elections.kalshi.com/trade-api/v2';

export class KalshiClient {
  private apiKeyId: string;
  private privateKey: crypto.KeyObject;

  constructor(apiKeyId: string, privateKeyPem: string) {
    this.apiKeyId = apiKeyId;
    // Normalize: replace literal \n with real newlines, trim whitespace
    const normalized = privateKeyPem
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .trim();
    // Wrap in PEM headers if raw base64 was passed (no headers)
    const pem = normalized.includes('-----')
      ? normalized
      : `-----BEGIN PRIVATE KEY-----\n${normalized}\n-----END PRIVATE KEY-----`;
    this.privateKey = crypto.createPrivateKey(pem);
  }

  private sign(
    timestampMs: number,
    method: string,
    path: string
  ): string {
    const message = `${timestampMs}${method.toUpperCase()}${path}`;
    const signature = crypto.sign('sha256', Buffer.from(message), {
      key: this.privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    });
    return signature.toString('base64');
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const timestampMs = Date.now();
    // Sign with path only (no query params)
    const pathWithoutQuery = path.split('?')[0];
    const signature = this.sign(timestampMs, method, pathWithoutQuery);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'KALSHI-ACCESS-KEY': this.apiKeyId,
      'KALSHI-ACCESS-TIMESTAMP': String(timestampMs),
      'KALSHI-ACCESS-SIGNATURE': signature,
    };

    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Kalshi API error ${response.status}: ${errorText}`
      );
    }

    return response.json() as Promise<T>;
  }

  async getBalance(): Promise<KalshiBalance> {
    const res = await this.request<{ balance: number; payout: number }>(
      'GET',
      '/portfolio/balance'
    );
    return res;
  }

  async getPositions(params?: {
    status?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ market_positions: KalshiPosition[]; cursor: string }> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('settlement_status', params.status);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    const qs = searchParams.toString();
    return this.request('GET', `/portfolio/positions${qs ? `?${qs}` : ''}`);
  }

  async getMarkets(params?: {
    status?: string;
    series_ticker?: string;
    limit?: number;
    cursor?: string;
    event_ticker?: string;
  }): Promise<{ markets: KalshiMarket[]; cursor: string }> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.series_ticker)
      searchParams.set('series_ticker', params.series_ticker);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    if (params?.event_ticker)
      searchParams.set('event_ticker', params.event_ticker);
    const qs = searchParams.toString();
    return this.request('GET', `/markets${qs ? `?${qs}` : ''}`);
  }

  async getMarket(ticker: string): Promise<{ market: KalshiMarket }> {
    return this.request('GET', `/markets/${ticker}`);
  }

  async getOrderbook(ticker: string): Promise<{ orderbook: KalshiOrderbook }> {
    return this.request('GET', `/markets/${ticker}/orderbook`);
  }

  async getEvents(params?: {
    status?: string;
    series_ticker?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ events: KalshiEvent[]; cursor: string }> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.series_ticker)
      searchParams.set('series_ticker', params.series_ticker);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    const qs = searchParams.toString();
    return this.request('GET', `/events${qs ? `?${qs}` : ''}`);
  }

  async createOrder(
    order: KalshiOrderInput
  ): Promise<{ order: KalshiOrder }> {
    return this.request('POST', '/portfolio/orders', order);
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.request('DELETE', `/portfolio/orders/${orderId}`);
  }

  async getOrders(params?: {
    ticker?: string;
    status?: string;
  }): Promise<{ orders: KalshiOrder[] }> {
    const searchParams = new URLSearchParams();
    if (params?.ticker) searchParams.set('ticker', params.ticker);
    if (params?.status) searchParams.set('status', params.status);
    const qs = searchParams.toString();
    return this.request('GET', `/portfolio/orders${qs ? `?${qs}` : ''}`);
  }
}
