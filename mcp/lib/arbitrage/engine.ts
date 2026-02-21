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
  polymarketTokenIdx: number; // 0 = YES token, 1 = NO token
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
export function findArbitrageOpportunities(
  matched: MatchedMarket[],
  minEdge = 0.01
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  for (const m of matched) {
    // Direction 1: BUY YES on Kalshi + BUY NO on Polymarket
    const edge1 = 1.0 - (m.kalshiYesPrice + m.polymarketNoPrice);
    if (edge1 > minEdge) {
      const cost = m.kalshiYesPrice + m.polymarketNoPrice;
      opportunities.push({
        id: `${m.kalshiTicker}-YES-KPNO`,
        eventName: m.kalshiQuestion,
        kalshiTicker: m.kalshiTicker,
        kalshiQuestion: m.kalshiQuestion,
        polymarketSlug: m.polymarketSlug,
        polymarketQuestion: m.polymarketQuestion,
        direction: `BUY YES on Kalshi @ ${(m.kalshiYesPrice * 100).toFixed(1)}¢ + BUY NO on Polymarket @ ${(m.polymarketNoPrice * 100).toFixed(1)}¢`,
        kalshiSide: 'yes',
        kalshiPrice: m.kalshiYesPrice,
        polymarketSide: 'NO',
        polymarketTokenIdx: 1, // index 1 = NO token
        polymarketPrice: m.polymarketNoPrice,
        edge: edge1,
        profitPerContract: edge1,
        totalCost: cost,
        roi: (edge1 / cost) * 100,
        matchConfidence: m.matchConfidence,
      });
    }

    // Direction 2: BUY NO on Kalshi + BUY YES on Polymarket
    const edge2 = 1.0 - (m.kalshiNoPrice + m.polymarketYesPrice);
    if (edge2 > minEdge) {
      const cost = m.kalshiNoPrice + m.polymarketYesPrice;
      opportunities.push({
        id: `${m.kalshiTicker}-NO-KPYES`,
        eventName: m.kalshiQuestion,
        kalshiTicker: m.kalshiTicker,
        kalshiQuestion: m.kalshiQuestion,
        polymarketSlug: m.polymarketSlug,
        polymarketQuestion: m.polymarketQuestion,
        direction: `BUY NO on Kalshi @ ${(m.kalshiNoPrice * 100).toFixed(1)}¢ + BUY YES on Polymarket @ ${(m.polymarketYesPrice * 100).toFixed(1)}¢`,
        kalshiSide: 'no',
        kalshiPrice: m.kalshiNoPrice,
        polymarketSide: 'YES',
        polymarketTokenIdx: 0, // index 0 = YES token
        polymarketPrice: m.polymarketYesPrice,
        edge: edge2,
        profitPerContract: edge2,
        totalCost: cost,
        roi: (edge2 / cost) * 100,
        matchConfidence: m.matchConfidence,
      });
    }
  }

  return opportunities.sort((a, b) => b.edge - a.edge);
}

/** Calculate how many contracts to buy given a max stake */
export function sizePosition(
  opportunity: ArbitrageOpportunity,
  maxStake: number
): {
  contracts: number;
  kalshiCost: number;
  polymarketCost: number;
  totalCost: number;
  guaranteedProfit: number;
} {
  const contracts = Math.floor(maxStake / opportunity.totalCost);
  if (contracts < 1) {
    return {
      contracts: 0,
      kalshiCost: 0,
      polymarketCost: 0,
      totalCost: 0,
      guaranteedProfit: 0,
    };
  }
  const kalshiCost = contracts * opportunity.kalshiPrice;
  const polymarketCost = contracts * opportunity.polymarketPrice;
  return {
    contracts,
    kalshiCost,
    polymarketCost,
    totalCost: kalshiCost + polymarketCost,
    guaranteedProfit: contracts * opportunity.edge,
  };
}
