import { ethers } from 'ethers';
import crypto from 'node:crypto';
import type { L2Credentials, PolymarketPosition } from './types.js';

const CLOB_URL = 'https://clob.polymarket.com';
const DATA_URL = 'https://data-api.polymarket.com';
const CHAIN_ID = 137; // Polygon

const DOMAIN = {
  name: 'ClobAuthDomain',
  version: '1',
  chainId: CHAIN_ID,
};

const CREATE_API_KEY_TYPES = {
  ClobAuth: [
    { name: 'address', type: 'address' },
    { name: 'timestamp', type: 'string' },
    { name: 'nonce', type: 'uint256' },
    { name: 'message', type: 'string' },
  ],
};

export class PolymarketClient {
  private wallet: ethers.Wallet;
  private creds?: L2Credentials;
  private funderAddress?: string;

  constructor(privateKey: string, creds?: L2Credentials, funderAddress?: string) {
    const key = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    this.wallet = new ethers.Wallet(key);
    this.creds = creds;
    this.funderAddress = funderAddress;
  }

  get address(): string {
    return this.funderAddress || this.wallet.address;
  }

  async deriveCredentials(): Promise<L2Credentials> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = '0';
    const message = 'This message attests that I control the given wallet';

    const signature = await this.wallet.signTypedData(DOMAIN, CREATE_API_KEY_TYPES, {
      address: this.wallet.address,
      timestamp,
      nonce,
      message,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      POLY_ADDRESS: this.wallet.address,
      POLY_SIGNATURE: signature,
      POLY_TIMESTAMP: timestamp,
      POLY_NONCE: nonce,
    };

    const response = await fetch(`${CLOB_URL}/auth/derive-api-key`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to derive Polymarket API key: ${response.status} ${text}`);
    }

    const data = (await response.json()) as L2Credentials;
    this.creds = data;
    return data;
  }

  private l2Sign(timestamp: string, method: string, requestPath: string, body?: string): string {
    if (!this.creds) throw new Error('L2 credentials not set');
    const message = timestamp + method.toUpperCase() + requestPath + (body || '');
    const hmac = crypto.createHmac('sha256', Buffer.from(this.creds.secret, 'base64'));
    hmac.update(message);
    return hmac.digest('base64');
  }

  private async clobRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.creds) throw new Error('Not authenticated. Call deriveCredentials() first.');

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyStr = body ? JSON.stringify(body) : '';
    const signature = this.l2Sign(timestamp, method, path, bodyStr);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      POLY_ADDRESS: this.address,
      POLY_SIGNATURE: signature,
      POLY_TIMESTAMP: timestamp,
      POLY_API_KEY: this.creds.apiKey,
      POLY_PASSPHRASE: this.creds.passphrase,
    };

    const response = await fetch(`${CLOB_URL}${path}`, {
      method,
      headers,
      body: bodyStr || undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Polymarket CLOB error ${response.status}: ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  async getPositions(address?: string): Promise<PolymarketPosition[]> {
    const params = new URLSearchParams();
    params.set('address', address || this.address);

    const response = await fetch(`${DATA_URL}/positions?${params.toString()}`);
    if (!response.ok) throw new Error(`Data API error: ${response.status}`);
    return response.json() as Promise<PolymarketPosition[]>;
  }
}
