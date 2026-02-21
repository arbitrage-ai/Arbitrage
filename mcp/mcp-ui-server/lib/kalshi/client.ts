import crypto from 'node:crypto';
import type { KalshiBalance, KalshiPosition } from './types.js';

const BASE_URL = 'https://api.elections.kalshi.com/trade-api/v2';

export class KalshiClient {
  private apiKeyId: string;
  private privateKey: crypto.KeyObject;

  constructor(apiKeyId: string, privateKeyPem: string) {
    this.apiKeyId = apiKeyId;
    const normalized = privateKeyPem.replace(/\\n/g, '\n').replace(/\\r/g, '').trim();
    const pem = normalized.includes('-----')
      ? normalized
      : `-----BEGIN PRIVATE KEY-----\n${normalized}\n-----END PRIVATE KEY-----`;
    this.privateKey = crypto.createPrivateKey(pem);
  }

  private sign(timestampMs: number, method: string, path: string): string {
    const message = `${timestampMs}${method.toUpperCase()}${path}`;
    const signature = crypto.sign('sha256', Buffer.from(message), {
      key: this.privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    });
    return signature.toString('base64');
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const timestampMs = Date.now();
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
      throw new Error(`Kalshi API error ${response.status}: ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  get keyId(): string {
    return this.apiKeyId;
  }

  async getBalance(): Promise<KalshiBalance> {
    return this.request<KalshiBalance>('GET', '/portfolio/balance');
  }

  async getPositions(): Promise<{ market_positions: KalshiPosition[]; cursor: string }> {
    return this.request('GET', '/portfolio/positions');
  }
}
