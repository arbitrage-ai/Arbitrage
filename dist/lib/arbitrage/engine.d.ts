import type { MatchedMarket } from './matcher.js';
export interface ArbitrageOpportunity {
    id: string;
    eventName: string;
    kalshiTicker: string;
    kalshiQuestion: string;
    polymarketSlug: string;
    polymarketQuestion: string;
    direction: string;
    kalshiSide: 'yes' | 'no';
    kalshiPrice: number;
    polymarketSide: 'YES' | 'NO';
    polymarketTokenIdx: number;
    polymarketTokenIds: string[];
    polymarketPrice: number;
    /** Guaranteed profit as decimal (0.03 = 3%) */
    edge: number;
    profitPerContract: number;
    totalCost: number;
    roi: number;
    matchConfidence: number;
    matchMethod: 'fuzzy' | 'search';
}
export interface ProfitBreakdown {
    contracts: number;
    kalshiCost: number;
    polymarketCost: number;
    totalInvestment: number;
    grossProfit: number;
    kalshiFees: number;
    netProfit: number;
    netROI: number;
    profitPer100: number;
}
/**
 * For each matched pair, check both trade directions for arbitrage.
 * Uses bid prices for realistic execution (what you can actually buy at).
 */
export declare function findArbitrageOpportunities(matched: MatchedMarket[], minEdge?: number): ArbitrageOpportunity[];
/** Calculate fee-aware profit breakdown for a given number of contracts */
export declare function calculateProfit(opp: ArbitrageOpportunity, maxStake: number): ProfitBreakdown;
/** Legacy sizePosition for backward compatibility */
export declare function sizePosition(opportunity: ArbitrageOpportunity, maxStake: number): {
    contracts: number;
    kalshiCost: number;
    polymarketCost: number;
    totalCost: number;
    guaranteedProfit: number;
};
