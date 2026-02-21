import type { MatchedMarket } from './matcher.js';
export interface ArbitrageOpportunity {
    id: string;
    eventName: string;
    kalshiTicker: string;
    kalshiQuestion: string;
    polymarketSlug: string;
    polymarketQuestion: string;
    /** Buy YES on Kalshi + NO on Polymarket, or vice versa */
    direction: string;
    /** Side to buy on Kalshi: 'yes' or 'no' */
    kalshiSide: 'yes' | 'no';
    kalshiPrice: number;
    polymarketSide: 'YES' | 'NO';
    polymarketTokenIdx: number;
    polymarketPrice: number;
    /** Guaranteed profit as decimal (0.03 = 3%) */
    edge: number;
    /** Profit in dollars per contract pair */
    profitPerContract: number;
    /** Total cost for one contract pair */
    totalCost: number;
    /** ROI as percent */
    roi: number;
    matchConfidence: number;
}
/**
 * For each matched pair, check both trade directions for arbitrage.
 * Arbitrage exists when: priceA + priceB < 1.00
 * (buy YES on one platform + NO on the other for guaranteed profit)
 */
export declare function findArbitrageOpportunities(matched: MatchedMarket[], minEdge?: number): ArbitrageOpportunity[];
/** Calculate how many contracts to buy given a max stake */
export declare function sizePosition(opportunity: ArbitrageOpportunity, maxStake: number): {
    contracts: number;
    kalshiCost: number;
    polymarketCost: number;
    totalCost: number;
    guaranteedProfit: number;
};
