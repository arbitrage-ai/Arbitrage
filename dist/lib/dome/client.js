const BASE_URL = 'https://api.domeapi.io/v1';
export class DomeClient {
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async request(path, params) {
        const url = new URL(`${BASE_URL}${path}`);
        if (params) {
            for (const [key, val] of Object.entries(params)) {
                if (Array.isArray(val)) {
                    for (const v of val)
                        url.searchParams.append(key, v);
                }
                else if (val !== undefined && val !== '') {
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
        return res.json();
    }
    async searchPolymarketMarkets(opts) {
        const params = {};
        if (opts.search)
            params.search = opts.search;
        if (opts.tags)
            params.tags = opts.tags;
        if (opts.status)
            params.status = opts.status;
        if (opts.min_volume)
            params.min_volume = String(opts.min_volume);
        if (opts.limit)
            params.limit = String(opts.limit);
        const data = await this.request('/polymarket/markets', params);
        return { markets: data.markets || [], total: data.pagination?.total || 0 };
    }
    async searchKalshiMarkets(opts) {
        const params = {};
        if (opts.search)
            params.search = opts.search;
        if (opts.status)
            params.status = opts.status;
        if (opts.min_volume)
            params.min_volume = String(opts.min_volume);
        if (opts.limit)
            params.limit = String(opts.limit);
        const data = await this.request('/kalshi/markets', params);
        return { markets: data.markets || [], total: data.pagination?.total || 0 };
    }
    async getMatchingSportsMarkets(opts) {
        const params = {};
        if (opts.polymarket_slugs?.length)
            params.polymarket_market_slug = opts.polymarket_slugs;
        if (opts.kalshi_event_tickers?.length)
            params.kalshi_event_ticker = opts.kalshi_event_tickers;
        return this.request('/matching-markets/sports', params);
    }
    async getPolymarketPositions(walletAddress) {
        const data = await this.request(`/polymarket/positions/wallet/${walletAddress}`);
        return { positions: data.positions || [], has_more: data.pagination?.has_more || false };
    }
    async getPolymarketMarketPrice(tokenId) {
        return this.request(`/polymarket/market-price/${tokenId}`);
    }
    async getKalshiMarketPrice(ticker) {
        return this.request(`/kalshi/market-price/${ticker}`);
    }
    async getWalletPnl(walletAddress, granularity = 'all') {
        return this.request(`/polymarket/wallet/pnl/${walletAddress}`, { granularity });
    }
}
