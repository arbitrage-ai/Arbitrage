import type { MatchedMarket } from './matcher.js';

// Kalshi charges ~7% fee on net profit for standard tier
const KALSHI_PROFIT_FEE = 0.07;

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
  /** Quality score: edge weighted by match confidence. Use this for ranking. */
  qualityScore: number;
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
 * Uses ask prices for realistic execution (what you can actually buy at).
 *
 * Sorted by qualityScore (edge * confidence), NOT raw edge.
 * This prevents garbage low-confidence matches from ranking above real opportunities.
 */
export function findArbitrageOpportunities(
  matched: MatchedMarket[],
  minEdge = 0.005
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  for (const m of matched) {
    if (m.kalshiYesPrice <= 0 || m.kalshiNoPrice <= 0) continue;
    if (m.polymarketYesPrice <= 0 || m.polymarketNoPrice <= 0) continue;

    // Direction 1: BUY YES on Kalshi + BUY NO on Polymarket
    const cost1 = m.kalshiYesPrice + m.polymarketNoPrice;
    const edge1 = 1.0 - cost1;
    if (edge1 > minEdge && cost1 > 0) {
      const qualityScore = edge1 * m.matchConfidence;
      opportunities.push({
        id: `${m.kalshiTicker}::YES+NO`,
        eventName: m.kalshiQuestion,
        kalshiTicker: m.kalshiTicker,
        kalshiQuestion: m.kalshiQuestion,
        polymarketSlug: m.polymarketSlug,
        polymarketQuestion: m.polymarketQuestion,
        direction: `BUY YES on Kalshi @ ${(m.kalshiYesPrice * 100).toFixed(1)}¢  +  BUY NO on Polymarket @ ${(m.polymarketNoPrice * 100).toFixed(1)}¢`,
        kalshiSide: 'yes',
        kalshiPrice: m.kalshiYesPrice,
        polymarketSide: 'NO',
        polymarketTokenIdx: 1,
        polymarketTokenIds: m.polymarketTokenIds,
        polymarketPrice: m.polymarketNoPrice,
        edge: edge1,
        profitPerContract: edge1,
        totalCost: cost1,
        roi: (edge1 / cost1) * 100,
        matchConfidence: m.matchConfidence,
        matchMethod: m.matchMethod,
        qualityScore,
      });
    }

    // Direction 2: BUY NO on Kalshi + BUY YES on Polymarket
    const cost2 = m.kalshiNoPrice + m.polymarketYesPrice;
    const edge2 = 1.0 - cost2;
    if (edge2 > minEdge && cost2 > 0) {
      const qualityScore = edge2 * m.matchConfidence;
      opportunities.push({
        id: `${m.kalshiTicker}::NO+YES`,
        eventName: m.kalshiQuestion,
        kalshiTicker: m.kalshiTicker,
        kalshiQuestion: m.kalshiQuestion,
        polymarketSlug: m.polymarketSlug,
        polymarketQuestion: m.polymarketQuestion,
        direction: `BUY NO on Kalshi @ ${(m.kalshiNoPrice * 100).toFixed(1)}¢  +  BUY YES on Polymarket @ ${(m.polymarketYesPrice * 100).toFixed(1)}¢`,
        kalshiSide: 'no',
        kalshiPrice: m.kalshiNoPrice,
        polymarketSide: 'YES',
        polymarketTokenIdx: 0,
        polymarketTokenIds: m.polymarketTokenIds,
        polymarketPrice: m.polymarketYesPrice,
        edge: edge2,
        profitPerContract: edge2,
        totalCost: cost2,
        roi: (edge2 / cost2) * 100,
        matchConfidence: m.matchConfidence,
        matchMethod: m.matchMethod,
        qualityScore,
      });
    }
  }

  // Sort by quality score: confidence-weighted edge, not raw edge
  return opportunities.sort((a, b) => b.qualityScore - a.qualityScore);
}

/** Calculate fee-aware profit breakdown for a given number of contracts */
export function calculateProfit(
  opp: ArbitrageOpportunity,
  maxStake: number
): ProfitBreakdown {
  const contracts = Math.floor(maxStake / opp.totalCost);
  if (contracts < 1) {
    return { contracts: 0, kalshiCost: 0, polymarketCost: 0, totalInvestment: 0, grossProfit: 0, kalshiFees: 0, netProfit: 0, netROI: 0, profitPer100: 0 };
  }

  const kalshiCost = contracts * opp.kalshiPrice;
  const polymarketCost = contracts * opp.polymarketPrice;
  const totalInvestment = kalshiCost + polymarketCost;
  const grossProfit = contracts * opp.edge;
  const kalshiFees = Math.max(0, grossProfit * KALSHI_PROFIT_FEE);
  const netProfit = grossProfit - kalshiFees;
  const netROI = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;

  return {
    contracts,
    kalshiCost,
    polymarketCost,
    totalInvestment,
    grossProfit,
    kalshiFees,
    netProfit,
    netROI,
    profitPer100: totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0,
  };
}

/** Legacy sizePosition for backward compatibility */
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
  const p = calculateProfit(opportunity, maxStake);
  return {
    contracts: p.contracts,
    kalshiCost: p.kalshiCost,
    polymarketCost: p.polymarketCost,
    totalCost: p.totalInvestment,
    guaranteedProfit: p.netProfit,
  };
}
