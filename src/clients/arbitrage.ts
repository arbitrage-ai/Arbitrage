import { KalshiMarket } from "./kalshi.js";
import { PolymarketMarket, PolymarketToken } from "./polymarket.js";

export interface ArbitrageOpportunity {
  description: string;
  kalshi_market: string;
  polymarket_market: string;
  kalshi_yes_price: number;
  kalshi_no_price: number;
  polymarket_yes_price: number;
  polymarket_no_price: number;
  strategy: string;
  expected_profit_pct: number;
  risk_level: "low" | "medium" | "high";
  details: string;
}

export interface OddsComparison {
  market_description: string;
  kalshi: {
    ticker: string;
    yes_price: number;
    no_price: number;
    implied_probability: number;
  } | null;
  polymarket: {
    condition_id: string;
    yes_price: number;
    no_price: number;
    implied_probability: number;
  } | null;
  spread: number;
  arbitrage_possible: boolean;
}

export function compareOdds(
  kalshiMarket: KalshiMarket | null,
  polymarketTokens: PolymarketToken[] | null,
  polymarketConditionId?: string,
  description?: string
): OddsComparison {
  const kalshiData = kalshiMarket
    ? {
        ticker: kalshiMarket.ticker,
        yes_price: kalshiMarket.yes_ask,
        no_price: kalshiMarket.no_ask,
        implied_probability: kalshiMarket.yes_ask * 100,
      }
    : null;

  let polyData: OddsComparison["polymarket"] = null;
  if (polymarketTokens?.length) {
    const yesToken = polymarketTokens.find(
      (t) => t.outcome.toLowerCase() === "yes"
    );
    const noToken = polymarketTokens.find(
      (t) => t.outcome.toLowerCase() === "no"
    );
    if (yesToken) {
      polyData = {
        condition_id: polymarketConditionId ?? yesToken.token_id,
        yes_price: yesToken.price,
        no_price: noToken?.price ?? 1 - yesToken.price,
        implied_probability: yesToken.price * 100,
      };
    }
  }

  const kalshiProb = kalshiData?.implied_probability ?? 0;
  const polyProb = polyData?.implied_probability ?? 0;
  const spread = Math.abs(kalshiProb - polyProb);

  const kalshiYes = kalshiData?.yes_price ?? 1;
  const polyNo = polyData?.no_price ?? 0;
  const kalshiNo = kalshiData?.no_price ?? 1;
  const polyYes = polyData?.yes_price ?? 0;

  const arbPossible =
    kalshiData != null &&
    polyData != null &&
    (kalshiYes + polyNo < 1 || kalshiNo + polyYes < 1);

  return {
    market_description: description ?? kalshiMarket?.title ?? "Unknown market",
    kalshi: kalshiData,
    polymarket: polyData,
    spread,
    arbitrage_possible: arbPossible,
  };
}

export function findArbitrageOpportunity(
  kalshiMarket: KalshiMarket,
  polymarketMarket: PolymarketMarket
): ArbitrageOpportunity | null {
  const polyYesToken = polymarketMarket.tokens.find(
    (t) => t.outcome.toLowerCase() === "yes"
  );
  const polyNoToken = polymarketMarket.tokens.find(
    (t) => t.outcome.toLowerCase() === "no"
  );

  if (!polyYesToken) return null;

  const kalshiYes = kalshiMarket.yes_ask;
  const kalshiNo = kalshiMarket.no_ask;
  const polyYes = polyYesToken.price;
  const polyNo = polyNoToken?.price ?? 1 - polyYesToken.price;

  // Strategy 1: Buy YES on cheaper platform, buy NO on other
  const strategy1Cost = kalshiYes + polyNo;
  const strategy2Cost = polyYes + kalshiNo;

  let strategy: string;
  let profitPct: number;
  let details: string;

  if (strategy1Cost < 1) {
    profitPct = ((1 - strategy1Cost) / strategy1Cost) * 100;
    strategy = `Buy YES on Kalshi at ${kalshiYes.toFixed(2)}, Buy NO on Polymarket at ${polyNo.toFixed(2)}`;
    details = `Total cost: $${strategy1Cost.toFixed(4)} per contract pair. Guaranteed payout: $1.00. Profit: $${(1 - strategy1Cost).toFixed(4)} (${profitPct.toFixed(2)}%)`;
  } else if (strategy2Cost < 1) {
    profitPct = ((1 - strategy2Cost) / strategy2Cost) * 100;
    strategy = `Buy YES on Polymarket at ${polyYes.toFixed(2)}, Buy NO on Kalshi at ${kalshiNo.toFixed(2)}`;
    details = `Total cost: $${strategy2Cost.toFixed(4)} per contract pair. Guaranteed payout: $1.00. Profit: $${(1 - strategy2Cost).toFixed(4)} (${profitPct.toFixed(2)}%)`;
  } else {
    return null;
  }

  const riskLevel: "low" | "medium" | "high" =
    profitPct > 5 ? "low" : profitPct > 2 ? "medium" : "high";

  return {
    description: kalshiMarket.title,
    kalshi_market: kalshiMarket.ticker,
    polymarket_market: polymarketMarket.condition_id,
    kalshi_yes_price: kalshiYes,
    kalshi_no_price: kalshiNo,
    polymarket_yes_price: polyYes,
    polymarket_no_price: polyNo,
    strategy,
    expected_profit_pct: profitPct,
    risk_level: riskLevel,
    details,
  };
}

export function calculateProfit(
  buyPrice: number,
  quantity: number,
  outcome: "win" | "lose"
): {
  investment: number;
  payout: number;
  profit: number;
  roi_pct: number;
} {
  const investment = buyPrice * quantity;
  const payout = outcome === "win" ? quantity : 0;
  const profit = payout - investment;
  const roiPct = (profit / investment) * 100;
  return { investment, payout, profit, roi_pct: roiPct };
}
