import { MCPServer, text, object, markdown, error } from "mcp-use/server";
import { z } from "zod";
import { KalshiClient } from "./clients/kalshi.js";
import { PolymarketClient } from "./clients/polymarket.js";
import { ESPNClient } from "./clients/espn.js";
import {
  compareOdds,
  findArbitrageOpportunity,
  calculateProfit,
} from "./clients/arbitrage.js";

// Helper to convert typed objects to plain Record<string, unknown> for object()
function toRecord<T>(value: T): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value));
}

const kalshi = new KalshiClient();
const polymarket = new PolymarketClient();
const espn = new ESPNClient();

const server = new MCPServer({
  name: "arbitrage-ai-mcp",
  title: "Arbitrage AI – Prediction Market Portfolio Manager",
  version: "1.0.0",
  description:
    "Manage Kalshi and Polymarket portfolios, conduct arbitrage, and get real-time ESPN data for prediction market trading.",
  baseUrl: process.env.MCP_URL || "http://localhost:3000",
});

// ============================================================================
// KALSHI TOOLS
// ============================================================================

server.tool(
  {
    name: "kalshi-get-portfolio",
    description:
      "Get your Kalshi portfolio including balance, positions, and P&L. Requires KALSHI_API_KEY.",
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async () => {
    try {
      const portfolio = await kalshi.getPortfolio();
      return object(toRecord(portfolio));
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.tool(
  {
    name: "kalshi-get-positions",
    description:
      "Get your current open positions on Kalshi. Requires KALSHI_API_KEY.",
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async () => {
    try {
      const positions = await kalshi.getPositions();
      return object(toRecord({ count: positions.length, positions }));
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.tool(
  {
    name: "kalshi-get-market-odds",
    description:
      "Get current odds/prices for a specific Kalshi market by ticker (e.g., 'KXBTCD-26FEB21').",
    schema: z.object({
      ticker: z.string().describe("Kalshi market ticker symbol"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async ({ ticker }) => {
    try {
      const market = await kalshi.getMarketOdds(ticker);
      return object(toRecord(market));
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.tool(
  {
    name: "kalshi-search-markets",
    description:
      "Search for Kalshi markets by keyword (e.g., 'NBA', 'Bitcoin', 'election').",
    schema: z.object({
      query: z.string().describe("Search query for market title"),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .default(20)
        .describe("Maximum number of results"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async ({ query, limit }) => {
    try {
      const markets = await kalshi.searchMarkets(query, limit);
      return object(toRecord({ count: markets.length, markets }));
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.tool(
  {
    name: "kalshi-place-trade",
    description:
      "Place a trade on Kalshi. Requires KALSHI_API_KEY. Use with caution — this executes a real order.",
    schema: z.object({
      ticker: z.string().describe("Kalshi market ticker"),
      side: z.enum(["yes", "no"]).describe("Side to buy"),
      quantity: z.number().min(1).describe("Number of contracts"),
      type: z
        .enum(["market", "limit"])
        .describe("Order type (market or limit)"),
      price: z
        .number()
        .min(0.01)
        .max(0.99)
        .optional()
        .describe("Limit price (required for limit orders, between 0.01 and 0.99)"),
    }),
    annotations: { destructiveHint: true, readOnlyHint: false },
  },
  async ({ ticker, side, quantity, type, price }) => {
    try {
      if (type === "limit" && price == null) {
        return error("Price is required for limit orders.");
      }
      const order = await kalshi.placeTrade({
        ticker,
        side,
        quantity,
        type,
        price,
      });
      return object(toRecord(order));
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.tool(
  {
    name: "kalshi-get-order-history",
    description:
      "Get your Kalshi order history, optionally filtered by market ticker. Requires KALSHI_API_KEY.",
    schema: z.object({
      ticker: z
        .string()
        .optional()
        .describe("Optional market ticker to filter orders"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async ({ ticker }) => {
    try {
      const orders = await kalshi.getOrderHistory(ticker);
      return object(toRecord({ count: orders.length, orders }));
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

// ============================================================================
// POLYMARKET TOOLS
// ============================================================================

server.tool(
  {
    name: "polymarket-get-portfolio",
    description:
      "Get your Polymarket portfolio including total value, P&L, and positions. Requires POLYMARKET_API_KEY.",
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async () => {
    try {
      const portfolio = await polymarket.getPortfolio();
      return object(toRecord(portfolio));
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.tool(
  {
    name: "polymarket-get-positions",
    description:
      "Get your current open positions on Polymarket. Requires POLYMARKET_API_KEY.",
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async () => {
    try {
      const positions = await polymarket.getPositions();
      return object(toRecord({ count: positions.length, positions }));
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.tool(
  {
    name: "polymarket-get-market-odds",
    description:
      "Get current odds/prices for a Polymarket market by condition ID or search query.",
    schema: z.object({
      condition_id: z
        .string()
        .optional()
        .describe("Polymarket condition ID for direct lookup"),
      query: z
        .string()
        .optional()
        .describe("Search query to find markets (e.g., 'Super Bowl winner')"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async ({ condition_id, query }) => {
    try {
      if (condition_id) {
        const tokens = await polymarket.getMarketOdds(condition_id);
        return object(toRecord({ condition_id, tokens }));
      }
      if (query) {
        const markets = await polymarket.getMarkets(query, 10);
        return object({
          count: markets.length,
          markets: markets.map((m) => ({
            condition_id: m.condition_id,
            question: m.question,
            tokens: m.tokens,
            volume: m.volume,
            liquidity: m.liquidity,
          })),
        });
      }
      return error("Provide either condition_id or query.");
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.tool(
  {
    name: "polymarket-search-markets",
    description:
      "Search for Polymarket markets by keyword (e.g., 'election', 'AI', 'sports').",
    schema: z.object({
      query: z.string().describe("Search query"),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .default(20)
        .describe("Maximum number of results"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async ({ query, limit }) => {
    try {
      const markets = await polymarket.getMarkets(query, limit);
      return object({
        count: markets.length,
        markets: markets.map((m) => ({
          condition_id: m.condition_id,
          question: m.question,
          category: m.category,
          tokens: m.tokens,
          volume: m.volume,
          liquidity: m.liquidity,
          end_date: m.end_date_iso,
          slug: m.slug,
        })),
      });
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.tool(
  {
    name: "polymarket-place-trade",
    description:
      "Place a trade on Polymarket. Requires POLYMARKET_API_KEY. Use with caution — this executes a real order.",
    schema: z.object({
      condition_id: z.string().describe("Polymarket condition ID"),
      outcome: z.string().describe("Outcome to trade (e.g., 'Yes' or 'No')"),
      side: z.enum(["BUY", "SELL"]).describe("Buy or sell"),
      size: z.number().min(1).describe("Number of shares"),
      price: z
        .number()
        .min(0.01)
        .max(0.99)
        .optional()
        .describe("Limit price (optional)"),
    }),
    annotations: { destructiveHint: true, readOnlyHint: false },
  },
  async ({ condition_id, outcome, side, size, price }) => {
    try {
      const order = await polymarket.placeTrade({
        condition_id,
        outcome,
        side,
        size,
        price,
      });
      return object(toRecord(order));
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.tool(
  {
    name: "polymarket-get-order-history",
    description:
      "Get your Polymarket order history. Requires POLYMARKET_API_KEY.",
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async () => {
    try {
      const orders = await polymarket.getOrderHistory();
      return object(toRecord({ count: orders.length, orders }));
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.tool(
  {
    name: "polymarket-get-comments",
    description:
      "Get community comments and discussion for a Polymarket market. Useful for sentiment analysis.",
    schema: z.object({
      condition_id: z.string().describe("Polymarket market condition ID"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async ({ condition_id }) => {
    try {
      const comments = await polymarket.getComments(condition_id);
      return object(toRecord({ count: comments.length, comments }));
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

// ============================================================================
// ESPN TOOLS
// ============================================================================

const leagueEnum = z.enum([
  "nfl",
  "nba",
  "mlb",
  "nhl",
  "college-football",
  "mens-college-basketball",
  "wnba",
  "mls",
  "ufc",
]);

server.tool(
  {
    name: "espn-get-live-scores",
    description:
      "Get live scores and game status from ESPN for a given league. Returns real-time data including scores, game clock, period, and live situation details — useful for spotting prediction market opportunities early.",
    schema: z.object({
      league: leagueEnum.describe("League to get scores for"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async ({ league }) => {
    try {
      const games = await espn.getLiveScores(league);
      return object(toRecord({ league, count: games.length, games }));
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.tool(
  {
    name: "espn-get-scoreboard",
    description:
      "Get the full ESPN scoreboard for a league, optionally for a specific date. Returns all games with scores, odds, venue, and status information.",
    schema: z.object({
      league: leagueEnum.describe("League to get scoreboard for"),
      date: z
        .string()
        .optional()
        .describe("Date in YYYYMMDD format (e.g., '20260221'). Defaults to today."),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async ({ league, date }) => {
    try {
      const scoreboard = await espn.getScoreboard(league, date);
      const games = scoreboard.events.map((e) => ({
        id: e.id,
        name: e.shortName,
        date: e.date,
        status: e.status.type.description,
      }));
      return object({
        league,
        count: games.length,
        games,
        leagues: scoreboard.leagues,
      });
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.tool(
  {
    name: "espn-get-game-details",
    description:
      "Get detailed information for a specific game including live play-by-play situation, odds, leaders, and headlines. This gives you game-changing information seconds early for prediction market opportunities.",
    schema: z.object({
      league: leagueEnum.describe("League"),
      game_id: z.string().describe("ESPN game/event ID"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async ({ league, game_id }) => {
    try {
      const details = await espn.getGameDetails(league, game_id);
      return object(toRecord(details));
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.tool(
  {
    name: "espn-get-game-odds",
    description:
      "Get betting odds from ESPN for games in a league. Includes spread, moneyline, and over/under from multiple sportsbooks. Compare with prediction market prices to find edge.",
    schema: z.object({
      league: leagueEnum.describe("League to get odds for"),
      game_id: z
        .string()
        .optional()
        .describe("Specific game ID (omit for all games)"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async ({ league, game_id }) => {
    try {
      const odds = await espn.getGameOdds(league, game_id);
      return object(toRecord({ league, count: odds.length, games: odds }));
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

// ============================================================================
// ARBITRAGE TOOLS
// ============================================================================

server.tool(
  {
    name: "compare-odds",
    description:
      "Compare odds between Kalshi and Polymarket for the same event. Provide tickers/IDs from both platforms to see the price spread and whether arbitrage is possible.",
    schema: z.object({
      kalshi_ticker: z
        .string()
        .optional()
        .describe("Kalshi market ticker for the event"),
      polymarket_condition_id: z
        .string()
        .optional()
        .describe("Polymarket condition ID for the same event"),
      description: z
        .string()
        .optional()
        .describe("Human-readable description of the event being compared"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async ({ kalshi_ticker, polymarket_condition_id, description }) => {
    try {
      let kalshiMarket = null;
      let polyTokens = null;

      if (kalshi_ticker) {
        kalshiMarket = await kalshi.getMarketOdds(kalshi_ticker);
      }
      if (polymarket_condition_id) {
        polyTokens = await polymarket.getMarketOdds(polymarket_condition_id);
      }

      if (!kalshiMarket && !polyTokens) {
        return error(
          "Provide at least one of kalshi_ticker or polymarket_condition_id."
        );
      }

      const comparison = compareOdds(
        kalshiMarket,
        polyTokens,
        polymarket_condition_id,
        description
      );
      return object(toRecord(comparison));
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.tool(
  {
    name: "find-arbitrage",
    description:
      "Check for arbitrage opportunities between a Kalshi market and a Polymarket market on the same event. Returns the optimal strategy and expected profit if arbitrage exists.",
    schema: z.object({
      kalshi_ticker: z.string().describe("Kalshi market ticker"),
      polymarket_condition_id: z
        .string()
        .describe("Polymarket condition ID for the same event"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async ({ kalshi_ticker, polymarket_condition_id }) => {
    try {
      const kalshiMarket = await kalshi.getMarketOdds(kalshi_ticker);
      const polyMarket = await polymarket.getMarket(polymarket_condition_id);

      const opportunity = findArbitrageOpportunity(kalshiMarket, polyMarket);

      if (!opportunity) {
        return object({
          arbitrage_found: false,
          message:
            "No arbitrage opportunity found. Combined prices on both sides exceed $1.00.",
          kalshi: {
            ticker: kalshiMarket.ticker,
            yes_ask: kalshiMarket.yes_ask,
            no_ask: kalshiMarket.no_ask,
          },
          polymarket: {
            condition_id: polyMarket.condition_id,
            tokens: polyMarket.tokens,
          },
        });
      }

      return object(toRecord({ arbitrage_found: true, opportunity }));
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }
);

server.tool(
  {
    name: "calculate-profit",
    description:
      "Calculate the potential profit/loss for a prediction market trade. Useful for sizing positions and evaluating risk.",
    schema: z.object({
      buy_price: z
        .number()
        .min(0.01)
        .max(0.99)
        .describe("Price per contract (e.g., 0.65 means 65 cents)"),
      quantity: z
        .number()
        .min(1)
        .describe("Number of contracts"),
      outcome: z
        .enum(["win", "lose"])
        .describe("Assumed outcome for this calculation"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async ({ buy_price, quantity, outcome }) => {
    const result = calculateProfit(buy_price, quantity, outcome);
    return object(toRecord(result));
  }
);

// ============================================================================
// RESOURCES
// ============================================================================

server.resource(
  {
    name: "trading-guide",
    uri: "guide://trading",
    title: "Prediction Market Trading Guide",
    description: "Guide to using this MCP server for prediction market trading",
    mimeType: "text/markdown",
  },
  async () => {
    return markdown(`# Prediction Market Trading Guide

## Getting Started

1. **Set up API keys** in your environment:
   - \`KALSHI_API_KEY\` — Your Kalshi API key
   - \`POLYMARKET_API_KEY\` — Your Polymarket API key

2. **Search markets** on both platforms to find events you want to trade.

3. **Compare odds** across platforms using the \`compare-odds\` tool.

4. **Check ESPN data** with \`espn-get-live-scores\` for real-time sports information.

## Arbitrage Strategy

1. Use \`kalshi-search-markets\` and \`polymarket-search-markets\` to find the same event on both platforms.
2. Use \`compare-odds\` to see the price spread.
3. Use \`find-arbitrage\` to check if a risk-free profit opportunity exists.
4. If arbitrage exists, execute trades on both platforms simultaneously.

## ESPN Edge

ESPN's API provides real-time game data including:
- Live scores and game clock
- Play-by-play situation (down, distance, possession)
- Red zone alerts
- Betting odds from sportsbooks

This information updates in real-time and can give you an edge in prediction markets tied to live sporting events.
`);
  }
);

// ============================================================================
// PROMPTS
// ============================================================================

server.prompt(
  {
    name: "arbitrage-scan",
    description:
      "Generate a prompt to scan for arbitrage opportunities across Kalshi and Polymarket",
    schema: z.object({
      topic: z
        .string()
        .optional()
        .default("sports")
        .describe("Market topic to scan (e.g., sports, politics, crypto)"),
    }),
  },
  async ({ topic }) => {
    return text(
      `Search for "${topic}" markets on both Kalshi and Polymarket. For each matching pair of markets about the same event, compare the odds and check for arbitrage opportunities. Report any cases where the combined cost of buying YES on one platform and NO on the other is less than $1.00, as these represent risk-free profit opportunities.`
    );
  }
);

server.prompt(
  {
    name: "live-sports-edge",
    description:
      "Generate a prompt to find live sports prediction market opportunities using ESPN data",
    schema: z.object({
      league: leagueEnum.describe("League to monitor"),
    }),
  },
  async ({ league }) => {
    return text(
      `Get live scores for ${league} from ESPN. For each active game, check the current score, game clock, and situation details. Then search for related prediction markets on Kalshi and Polymarket. Identify any markets where the current game situation suggests the market price hasn't adjusted yet — these represent early information opportunities.`
    );
  }
);

// ============================================================================
// START SERVER
// ============================================================================

await server.listen();
