import { ethers } from 'ethers';
import crypto from 'node:crypto';
const CLOB_URL = 'https://clob.polymarket.com';
const GAMMA_URL = 'https://gamma-api.polymarket.com';
const DATA_URL = 'https://data-api.polymarket.com';
const CHAIN_ID = 137; // Polygon
const POLYGON_RPCS = [
    'https://polygon-rpc.com',
    'https://rpc.ankr.com/polygon',
    'https://polygon-bor-rpc.publicnode.com',
];
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // USDC.e on Polygon
const USDC_NATIVE = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'; // Native USDC on Polygon
const ERC20_BALANCE_OF = '0x70a08231'; // balanceOf(address) selector
// EIP-712 domain and types for Polymarket API key derivation
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
    wallet;
    creds;
    funderAddress;
    constructor(privateKey, creds, funderAddress) {
        const key = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
        this.wallet = new ethers.Wallet(key);
        this.creds = creds;
        this.funderAddress = funderAddress;
    }
    get address() {
        return this.funderAddress || this.wallet.address;
    }
    async deriveCredentials() {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = '0';
        const message = 'This message attests that I control the given wallet';
        const signature = await this.wallet.signTypedData(DOMAIN, CREATE_API_KEY_TYPES, {
            address: this.wallet.address,
            timestamp,
            nonce,
            message,
        });
        const headers = {
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
        const data = (await response.json());
        this.creds = data;
        return data;
    }
    setCreds(creds) {
        this.creds = creds;
    }
    l2Sign(timestamp, method, requestPath, body) {
        if (!this.creds)
            throw new Error('L2 credentials not set');
        const message = timestamp + method.toUpperCase() + requestPath + (body || '');
        const hmac = crypto.createHmac('sha256', Buffer.from(this.creds.secret, 'base64'));
        hmac.update(message);
        return hmac.digest('base64');
    }
    async clobRequest(method, path, body) {
        if (!this.creds)
            throw new Error('Not authenticated. Call deriveCredentials() first.');
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const bodyStr = body ? JSON.stringify(body) : '';
        const signature = this.l2Sign(timestamp, method, path, bodyStr);
        const headers = {
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
        return response.json();
    }
    // ---- Gamma API (no auth) ----
    async searchEvents(params) {
        const searchParams = new URLSearchParams();
        if (params?.limit)
            searchParams.set('limit', String(params.limit));
        if (params?.offset)
            searchParams.set('offset', String(params.offset));
        if (params?.active !== undefined)
            searchParams.set('active', String(params.active));
        if (params?.closed !== undefined)
            searchParams.set('closed', String(params.closed));
        if (params?.order)
            searchParams.set('order', params.order);
        if (params?.ascending !== undefined)
            searchParams.set('ascending', String(params.ascending));
        if (params?.tag_id)
            searchParams.set('tag_id', String(params.tag_id));
        const qs = searchParams.toString();
        const response = await fetch(`${GAMMA_URL}/events${qs ? `?${qs}` : ''}`);
        if (!response.ok)
            throw new Error(`Gamma API error: ${response.status}`);
        return response.json();
    }
    async searchMarkets(params) {
        const searchParams = new URLSearchParams();
        if (params?.limit)
            searchParams.set('limit', String(params.limit));
        if (params?.offset)
            searchParams.set('offset', String(params.offset));
        if (params?.active !== undefined)
            searchParams.set('active', String(params.active));
        if (params?.closed !== undefined)
            searchParams.set('closed', String(params.closed));
        if (params?.tag_id)
            searchParams.set('tag_id', String(params.tag_id));
        if (params?.slug)
            searchParams.set('slug', params.slug);
        const qs = searchParams.toString();
        const response = await fetch(`${GAMMA_URL}/markets${qs ? `?${qs}` : ''}`);
        if (!response.ok)
            throw new Error(`Gamma API error: ${response.status}`);
        return response.json();
    }
    async getMarket(idOrSlug) {
        const response = await fetch(`${GAMMA_URL}/markets/${idOrSlug}`);
        if (!response.ok)
            throw new Error(`Gamma API error: ${response.status}`);
        return response.json();
    }
    async searchText(query) {
        const response = await fetch(`${GAMMA_URL}/public-search?query=${encodeURIComponent(query)}`);
        if (!response.ok)
            throw new Error(`Gamma search error: ${response.status}`);
        return response.json();
    }
    // ---- CLOB API (L2 auth) ----
    async getPrice(tokenId, side) {
        const params = new URLSearchParams({ token_id: tokenId });
        if (side)
            params.set('side', side);
        return this.clobRequest('GET', `/price?${params.toString()}`);
    }
    async getMidpoint(tokenId) {
        return this.clobRequest('GET', `/midpoint?token_id=${tokenId}`);
    }
    async getOrderbook(tokenId) {
        return this.clobRequest('GET', `/book?token_id=${tokenId}`);
    }
    async placeOrder(order) {
        // Build order with signing
        const orderPayload = {
            tokenID: order.tokenId,
            price: order.price,
            size: order.size,
            side: order.side,
            feeRateBps: '0',
            nonce: '0',
            taker: '0x0000000000000000000000000000000000000000',
            maker: this.address,
            expiration: '0',
            signatureType: 2,
        };
        return this.clobRequest('POST', '/order', {
            order: orderPayload,
            orderType: order.orderType || 'GTC',
            tickSize: '0.01',
            negRisk: false,
        });
    }
    async cancelOrder(orderId) {
        await this.clobRequest('DELETE', `/order/${orderId}`);
    }
    async cancelAll() {
        await this.clobRequest('DELETE', '/cancel-all');
    }
    async getOpenOrders() {
        const result = await this.clobRequest('GET', '/orders');
        return result;
    }
    // ---- Data API ----
    async getPositions(address, conditionId) {
        const params = new URLSearchParams();
        params.set('user', address || this.address);
        if (conditionId)
            params.set('market', conditionId);
        const response = await fetch(`${DATA_URL}/positions?${params.toString()}`);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Data API error ${response.status}: ${text}`);
        }
        return response.json();
    }
    async getTrades(address, marketId) {
        const params = new URLSearchParams();
        params.set('user', address || this.address);
        if (marketId)
            params.set('market', marketId);
        const response = await fetch(`${DATA_URL}/trades?${params.toString()}`);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Data API error ${response.status}: ${text}`);
        }
        return response.json();
    }
    // ---- On-chain balance ----
    async getUSDCBalance(address) {
        const raw = (address || this.address).toLowerCase().replace('0x', '');
        const paddedAddr = raw.padStart(64, '0'); // 40-char address → 64-char ABI-encoded
        const callBalance = async (token, rpcUrl) => {
            const data = `${ERC20_BALANCE_OF}${paddedAddr}`;
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'eth_call',
                    params: [{ to: token, data }, 'latest'],
                }),
            });
            const json = (await response.json());
            if (json.error) {
                const msg = json.error.message ?? json.error.code ?? JSON.stringify(json.error);
                throw new Error(`RPC error: ${msg}`);
            }
            const raw = BigInt(json.result || '0x0');
            return Number(raw) / 1e6; // USDC has 6 decimals
        };
        const tryRpc = async (token) => {
            let lastErr = null;
            for (const rpc of POLYGON_RPCS) {
                try {
                    return await callBalance(token, rpc);
                }
                catch (e) {
                    lastErr = e instanceof Error ? e : new Error(String(e));
                }
            }
            throw lastErr ?? new Error('All Polygon RPCs failed');
        };
        const [usdc, usdcNative] = await Promise.all([
            tryRpc(USDC_ADDRESS),
            tryRpc(USDC_NATIVE),
        ]);
        return { usdc, usdcNative };
    }
    // ---- Gamma API response parsing helpers ----
    static parseMarketFields(raw) {
        const parse = (val) => {
            if (Array.isArray(val))
                return val.map(String);
            if (typeof val === 'string') {
                try {
                    return JSON.parse(val);
                }
                catch {
                    return [];
                }
            }
            return [];
        };
        return {
            outcomes: parse(raw.outcomes || raw.outcome_prices),
            outcomePrices: parse(raw.outcomePrices || raw.outcome_prices),
            clobTokenIds: parse(raw.clobTokenIds || raw.clob_token_ids),
        };
    }
}
