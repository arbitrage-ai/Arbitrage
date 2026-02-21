import type { KalshiMarket } from '../kalshi/types.js';
import type { PolymarketMarket } from '../polymarket/types.js';
export interface MatchedMarket {
    kalshiTicker: string;
    kalshiQuestion: string;
    kalshiYesPrice: number;
    kalshiNoPrice: number;
    polymarketSlug: string;
    polymarketQuestion: string;
    polymarketYesPrice: number;
    polymarketNoPrice: number;
    matchConfidence: number;
}
/**
 * Fuzzy-match Kalshi markets to Polymarket markets.
 * Uses a combination of string similarity and keyword overlap.
 * Only returns matches with confidence >= threshold.
 */
export declare function matchMarketsAcrossPlatforms(kalshiMarkets: KalshiMarket[], polyMarkets: PolymarketMarket[], threshold?: number): MatchedMarket[];
