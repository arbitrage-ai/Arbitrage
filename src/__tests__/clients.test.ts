import { describe, it, expect } from "vitest";
import { KalshiClient } from "../clients/kalshi.js";
import { PolymarketClient } from "../clients/polymarket.js";
import { ESPNClient } from "../clients/espn.js";

describe("KalshiClient", () => {
  it("initializes with default configuration", () => {
    const client = new KalshiClient();
    expect(client).toBeInstanceOf(KalshiClient);
  });

  it("initializes with custom configuration", () => {
    const client = new KalshiClient({
      apiKey: "test-key",
      baseUrl: "https://custom.api.com",
    });
    expect(client).toBeInstanceOf(KalshiClient);
  });

  it("throws error when getting portfolio without API key", async () => {
    const client = new KalshiClient({ apiKey: undefined });
    await expect(client.getPortfolio()).rejects.toThrow("KALSHI_API_KEY");
  });

  it("throws error when getting positions without API key", async () => {
    const client = new KalshiClient({ apiKey: undefined });
    await expect(client.getPositions()).rejects.toThrow("KALSHI_API_KEY");
  });

  it("throws error when placing trade without API key", async () => {
    const client = new KalshiClient({ apiKey: undefined });
    await expect(
      client.placeTrade({
        ticker: "TEST",
        side: "yes",
        quantity: 1,
        type: "market",
      })
    ).rejects.toThrow("KALSHI_API_KEY");
  });

  it("throws error when getting order history without API key", async () => {
    const client = new KalshiClient({ apiKey: undefined });
    await expect(client.getOrderHistory()).rejects.toThrow("KALSHI_API_KEY");
  });
});

describe("PolymarketClient", () => {
  it("initializes with default configuration", () => {
    const client = new PolymarketClient();
    expect(client).toBeInstanceOf(PolymarketClient);
  });

  it("initializes with custom configuration", () => {
    const client = new PolymarketClient({
      apiKey: "test-key",
      baseUrl: "https://custom.api.com",
    });
    expect(client).toBeInstanceOf(PolymarketClient);
  });

  it("throws error when getting portfolio without API key", async () => {
    const client = new PolymarketClient({ apiKey: undefined });
    await expect(client.getPortfolio()).rejects.toThrow("POLYMARKET_API_KEY");
  });

  it("throws error when getting positions without API key", async () => {
    const client = new PolymarketClient({ apiKey: undefined });
    await expect(client.getPositions()).rejects.toThrow("POLYMARKET_API_KEY");
  });

  it("throws error when placing trade without API key", async () => {
    const client = new PolymarketClient({ apiKey: undefined });
    await expect(
      client.placeTrade({
        condition_id: "0xabc",
        outcome: "Yes",
        side: "BUY",
        size: 1,
      })
    ).rejects.toThrow("POLYMARKET_API_KEY");
  });

  it("throws error when getting order history without API key", async () => {
    const client = new PolymarketClient({ apiKey: undefined });
    await expect(client.getOrderHistory()).rejects.toThrow("POLYMARKET_API_KEY");
  });
});

describe("ESPNClient", () => {
  it("initializes with default configuration", () => {
    const client = new ESPNClient();
    expect(client).toBeInstanceOf(ESPNClient);
  });

  it("initializes with custom configuration", () => {
    const client = new ESPNClient({
      baseUrl: "https://custom.espn.com",
    });
    expect(client).toBeInstanceOf(ESPNClient);
  });
});
