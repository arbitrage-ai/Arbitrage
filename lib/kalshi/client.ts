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
const API_PATH_PREFIX = '/trade-api/v2';

function chunkString(value: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += size) {
    chunks.push(value.slice(i, i + size));
  }
  return chunks;
}

function normalizePrivateKeyPem(privateKeyPem: string): string {
  const input = privateKeyPem.replace(/\\r/g, '').replace(/\\n/g, '\n').replace(/\r/g, '').trim();

  // If we have BEGIN/END markers (possibly one-line), normalize body to 64-char PEM lines.
  const beginMatch = input.match(/-----BEGIN ([A-Z ]+)-----/);
  const endMatch = input.match(/-----END ([A-Z ]+)-----/);
  if (!beginMatch && endMatch) {
    throw new Error(
      'Private key appears malformed: missing -----BEGIN ... PRIVATE KEY----- marker.'
    );
  }
  if (beginMatch && !endMatch) {
    const label = beginMatch[1].trim();
    const beginMarker = `-----BEGIN ${label}-----`;
    const beginIdx = input.indexOf(beginMarker);
    const bodyRaw = input
      .slice(beginIdx + beginMarker.length)
      .replace(/[^A-Za-z0-9+/=]/g, '');

    if (bodyRaw.length === 0) {
      throw new Error('Private key body is empty');
    }

    const body = chunkString(bodyRaw, 64).join('\n');
    return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;
  }
  if (beginMatch && endMatch) {
    const label = beginMatch[1].trim();
    const endLabel = endMatch[1].trim();
    if (label !== endLabel) {
      throw new Error(
        `Private key markers mismatch: BEGIN ${label} but END ${endLabel}.`
      );
    }

    const beginMarker = `-----BEGIN ${label}-----`;
    const endMarker = `-----END ${label}-----`;
    const beginIdx = input.indexOf(beginMarker);
    const endIdx = input.indexOf(endMarker);

    if (beginIdx >= 0 && endIdx > beginIdx) {
      const bodyRaw = input
        .slice(beginIdx + beginMarker.length, endIdx)
        .replace(/[^A-Za-z0-9+/=]/g, '');
      if (bodyRaw.length === 0) {
        throw new Error('Private key body is empty');
      }
      const body = chunkString(bodyRaw, 64).join('\n');
      return `${beginMarker}\n${body}\n${endMarker}`;
    }
  }

  // Raw base64 without PEM markers.
  const base64Body = input.replace(/[^A-Za-z0-9+/=]/g, '');
  if (base64Body.length === 0) {
    throw new Error('Private key content is empty');
  }
  const body = chunkString(base64Body, 64).join('\n');
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
}

export class KalshiClient {
  private apiKeyId: string;
  private privateKey: crypto.KeyObject;

  constructor(apiKeyId: string, privateKeyPem: string) {
    this.apiKeyId = apiKeyId;
    const pem = normalizePrivateKeyPem(privateKeyPem);
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
    const pathWithoutQuery = path.split('?')[0];
    const primarySigningPath = `${API_PATH_PREFIX}${pathWithoutQuery}`;
    const fallbackSigningPath = pathWithoutQuery;

    const send = async (signingPath: string): Promise<Response> => {
      const signature = this.sign(timestampMs, method, signingPath);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'KALSHI-ACCESS-KEY': this.apiKeyId,
        'KALSHI-ACCESS-TIMESTAMP': String(timestampMs),
        'KALSHI-ACCESS-SIGNATURE': signature,
      };

      return fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    };

    let response = await send(primarySigningPath);
    if (
      !response.ok &&
      response.status === 401 &&
      primarySigningPath !== fallbackSigningPath
    ) {
      const errorText = await response.text();
      const isBadSignature =
        errorText.includes('INCORRECT_API_KEY_SIGNATURE') ||
        errorText.includes('authentication_error');

      if (isBadSignature) {
        response = await send(fallbackSigningPath);
      } else {
        throw new Error(`Kalshi API error ${response.status}: ${errorText}`);
      }
    }

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
