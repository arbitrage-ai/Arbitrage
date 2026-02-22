import type { KalshiMarket } from '../kalshi/types.js';
import type { PolymarketMarket } from '../polymarket/types.js';
import { PolymarketClient } from '../polymarket/client.js';
export interface MatchedMarket {
    kalshiTicker: string;
    kalshiQuestion: string;
    kalshiYesPrice: number;
    kalshiNoPrice: number;
    kalshiYesBid: number;
    kalshiYesAsk: number;
    polymarketSlug: string;
    polymarketQuestion: string;
    polymarketYesPrice: number;
    polymarketNoPrice: number;
    polymarketTokenIds: string[];
    matchConfidence: number;
    matchMethod: 'fuzzy' | 'search';
}
/**
 * Phase 1: Fuzzy matching of pre-fetched market lists.
 */
export declare function matchMarketsAcrossPlatforms(kalshiMarkets: KalshiMarket[], polyMarkets: PolymarketMarket[], threshold?: number): MatchedMarket[];
/**
 * Extract 3-5 word search query from a Kalshi market title for Polymarket lookup.
 */
export declare function extractSearchTerms(text: string): string;
/**
 * Phase 2: Search-based matching. Tries Polymarket searchText per market;
 * when it returns 422, falls back to scoring against pre-fetched polyMarkets.
 */
export declare function searchBasedMatch(kalshiMarkets: KalshiMarket[], alreadyMatchedTickers: Set<string>, polyClient: PolymarketClient, threshold?: number, batchSize?: number, maxSearches?: number, polyMarketsFallback?: PolymarketMarket[], usedPolyIds?: Set<string>): Promise<MatchedMarket[]>;
