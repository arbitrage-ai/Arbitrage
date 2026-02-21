import { describe, it, expect } from "vitest";
import {
  compareOdds,
  findArbitrageOpportunity,
  calculateProfit,
} from "../clients/arbitrage.js";
import type { KalshiMarket } from "../clients/kalshi.js";
import type {
  PolymarketMarket,
  PolymarketToken,
} from "../clients/polymarket.js";

function makeKalshiMarket(overrides: Partial<KalshiMarket> = {}): KalshiMarket {
  return {
    ticker: "TEST-MARKET",
    title: "Will Test happen?",
    category: "test",
    status: "open",
    yes_bid: 0.60,
    yes_ask: 0.62,
    no_bid: 0.36,
    no_ask: 0.38,
    volume: 1000,
    open_interest: 500,
    expiration_time: "2026-03-01T00:00:00Z",
    ...overrides,
  };
}

function makePolymarketMarket(
  yesPrice: number,
  overrides: Partial<PolymarketMarket> = {}
): PolymarketMarket {
  return {
    condition_id: "0xabc123",
    question: "Will Test happen?",
    description: "Test market",
    category: "test",
    end_date_iso: "2026-03-01T00:00:00Z",
    active: true,
    closed: false,
    tokens: [
      { token_id: "t1", outcome: "Yes", price: yesPrice },
      { token_id: "t2", outcome: "No", price: 1 - yesPrice },
    ],
    volume: 50000,
    liquidity: 10000,
    slug: "test-market",
    ...overrides,
  };
}

describe("compareOdds", () => {
  it("compares Kalshi and Polymarket odds correctly", () => {
    const kalshi = makeKalshiMarket({ yes_ask: 0.62, no_ask: 0.38 });
    const polyTokens: PolymarketToken[] = [
      { token_id: "t1", outcome: "Yes", price: 0.65 },
      { token_id: "t2", outcome: "No", price: 0.35 },
    ];

    const result = compareOdds(kalshi, polyTokens, "0xabc", "Test event");
    expect(result.market_description).toBe("Test event");
    expect(result.kalshi).not.toBeNull();
    expect(result.kalshi!.yes_price).toBe(0.62);
    expect(result.polymarket).not.toBeNull();
    expect(result.polymarket!.yes_price).toBe(0.65);
    expect(result.spread).toBeCloseTo(3, 0);
  });

  it("handles null Kalshi market", () => {
    const polyTokens: PolymarketToken[] = [
      { token_id: "t1", outcome: "Yes", price: 0.55 },
      { token_id: "t2", outcome: "No", price: 0.45 },
    ];

    const result = compareOdds(null, polyTokens, "0xabc", "Test");
    expect(result.kalshi).toBeNull();
    expect(result.polymarket).not.toBeNull();
    expect(result.arbitrage_possible).toBe(false);
  });

  it("handles null Polymarket tokens", () => {
    const kalshi = makeKalshiMarket();
    const result = compareOdds(kalshi, null);
    expect(result.kalshi).not.toBeNull();
    expect(result.polymarket).toBeNull();
    expect(result.arbitrage_possible).toBe(false);
  });

  it("detects arbitrage when combined prices are less than 1", () => {
    const kalshi = makeKalshiMarket({ yes_ask: 0.40, no_ask: 0.45 });
    const polyTokens: PolymarketToken[] = [
      { token_id: "t1", outcome: "Yes", price: 0.50 },
      { token_id: "t2", outcome: "No", price: 0.50 },
    ];

    const result = compareOdds(kalshi, polyTokens, "0xabc");
    expect(result.arbitrage_possible).toBe(true);
  });

  it("reports no arbitrage when prices sum to 1 or more", () => {
    const kalshi = makeKalshiMarket({ yes_ask: 0.62, no_ask: 0.40 });
    const polyTokens: PolymarketToken[] = [
      { token_id: "t1", outcome: "Yes", price: 0.65 },
      { token_id: "t2", outcome: "No", price: 0.38 },
    ];

    const result = compareOdds(kalshi, polyTokens, "0xabc");
    expect(result.arbitrage_possible).toBe(false);
  });
});

describe("findArbitrageOpportunity", () => {
  it("finds arbitrage when Kalshi YES + Polymarket NO < 1", () => {
    const kalshi = makeKalshiMarket({ yes_ask: 0.40, no_ask: 0.55 });
    const poly = makePolymarketMarket(0.70);

    const result = findArbitrageOpportunity(kalshi, poly);
    expect(result).not.toBeNull();
    expect(result!.expected_profit_pct).toBeGreaterThan(0);
    expect(result!.strategy).toContain("Buy YES on Kalshi");
    expect(result!.strategy).toContain("Buy NO on Polymarket");
  });

  it("finds arbitrage when Polymarket YES + Kalshi NO < 1", () => {
    const kalshi = makeKalshiMarket({ yes_ask: 0.70, no_ask: 0.35 });
    const poly = makePolymarketMarket(0.40);

    const result = findArbitrageOpportunity(kalshi, poly);
    expect(result).not.toBeNull();
    expect(result!.expected_profit_pct).toBeGreaterThan(0);
    expect(result!.strategy).toContain("Buy YES on Polymarket");
    expect(result!.strategy).toContain("Buy NO on Kalshi");
  });

  it("returns null when no arbitrage exists", () => {
    const kalshi = makeKalshiMarket({ yes_ask: 0.62, no_ask: 0.40 });
    const poly = makePolymarketMarket(0.60);

    const result = findArbitrageOpportunity(kalshi, poly);
    expect(result).toBeNull();
  });

  it("returns null when Polymarket has no Yes token", () => {
    const kalshi = makeKalshiMarket();
    const poly = makePolymarketMarket(0.60);
    poly.tokens = [{ token_id: "t2", outcome: "No", price: 0.40 }];

    const result = findArbitrageOpportunity(kalshi, poly);
    expect(result).toBeNull();
  });

  it("sets correct risk levels", () => {
    // Large profit = low risk
    const kalshi = makeKalshiMarket({ yes_ask: 0.30, no_ask: 0.55 });
    const poly = makePolymarketMarket(0.80);

    const result = findArbitrageOpportunity(kalshi, poly);
    expect(result).not.toBeNull();
    expect(result!.risk_level).toBe("low");
  });
});

describe("calculateProfit", () => {
  it("calculates winning trade correctly", () => {
    const result = calculateProfit(0.60, 10, "win");
    expect(result.investment).toBe(6.0);
    expect(result.payout).toBe(10);
    expect(result.profit).toBeCloseTo(4.0);
    expect(result.roi_pct).toBeCloseTo(66.67, 1);
  });

  it("calculates losing trade correctly", () => {
    const result = calculateProfit(0.60, 10, "lose");
    expect(result.investment).toBe(6.0);
    expect(result.payout).toBe(0);
    expect(result.profit).toBe(-6.0);
    expect(result.roi_pct).toBe(-100);
  });

  it("handles edge case of very cheap contracts", () => {
    const result = calculateProfit(0.05, 100, "win");
    expect(result.investment).toBe(5.0);
    expect(result.payout).toBe(100);
    expect(result.profit).toBe(95);
    expect(result.roi_pct).toBe(1900);
  });

  it("handles edge case of expensive contracts", () => {
    const result = calculateProfit(0.95, 10, "win");
    expect(result.investment).toBeCloseTo(9.5);
    expect(result.payout).toBe(10);
    expect(result.profit).toBeCloseTo(0.5);
    expect(result.roi_pct).toBeCloseTo(5.26, 1);
  });
});
