# AI-Native Execusion Layer for Prediction Markets. - ArbitrageAI

A Model Context Protocol (MCP) server for prediction market trading and cross-platform arbitrage detection across **Kalshi** and **Polymarket**, with **ESPN** sports data integration for edge analysis. Built on the [mcp-use](https://mcp-use.com) framework.

## What It Does

This server gives any MCP-compatible AI assistant (Claude, ChatGPT, Cursor, etc.) the ability to:

- **Search and discover** prediction markets across Kalshi and Polymarket simultaneously
- **Detect arbitrage** opportunities where the same event is priced differently on each platform
- **Find mispricing** in multi-outcome events where outcome prices don't sum to $1
- **Place and manage orders** on both Kalshi and Polymarket
- **Track portfolios** with unified balance, positions, and P&L across platforms
- **Pull live sports data** from ESPN — scores, odds, player stats, box scores — and compare sportsbook lines against prediction market prices to identify edges
- **Execute arbitrage** end-to-end with a single tool call (dry-run or live)

All of this is exposed as 20 MCP tools and 4 interactive React widgets that render inline in the client UI.

---

## Table of Contents

- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Authentication](#authentication)
- [Tools Reference](#tools-reference)
  - [Authentication](#authentication-tools)
  - [Market Discovery](#market-discovery-tools)
  - [Portfolio Management](#portfolio-management-tools)
  - [Order Execution](#order-execution-tools)
  - [ESPN Sports Data](#espn-sports-data-tools)
  - [Arbitrage & Edge Detection](#arbitrage--edge-detection-tools)
- [Widgets](#widgets)
- [Library Internals](#library-internals)
  - [Kalshi Client](#kalshi-client)
  - [Polymarket Client](#polymarket-client)
  - [ESPN Client](#espn-client)
  - [Dome Client](#dome-client)
  - [Arbitrage Engine](#arbitrage-engine)
  - [Cross-Platform Matcher](#cross-platform-matcher)
  - [Utilities](#utilities)
- [Intent Routing](#intent-routing)
- [Project Structure](#project-structure)
- [Development](#development)
- [Technical Design Notes](#technical-design-notes)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Client (AI)                       │
│              Claude / ChatGPT / Cursor / etc.            │
└─────────────────┬───────────────────────────────────────┘
                  │  MCP Protocol (HTTP, port 3000)
┌─────────────────▼───────────────────────────────────────┐
│              prediction-market-alpha v2.0.0              │
│                   mcp-use server                        │
├─────────────────────────────────────────────────────────┤
│  20 Tools  │  4 Widgets  │  Intent Routing Description  │
├─────────────────────────────────────────────────────────┤
│  tools/     │  resources/  │  index.ts                   │
│  auth.ts    │  arbitrage-  │                             │
│  markets.ts │    scanner/  │                             │
│  portfolio  │  portfolio-  │                             │
│  trading.ts │    dashboard/│                             │
│  espn.ts    │  live-scores/│                             │
│  arbitrage  │  trade-      │                             │
│    .ts      │    confirm/  │                             │
├─────────────────────────────────────────────────────────┤
│                      lib/                                │
│  kalshi/  polymarket/  espn/  dome/  arbitrage/  utils/  │
└────┬──────────┬─────────┬──────┬───────────────────┬────┘
     │          │         │      │                   │
     ▼          ▼         ▼      ▼                   ▼
  Kalshi    Polymarket   ESPN   Dome API         Polygon
  REST API  Gamma/CLOB   API   (aggregator)     RPC (USDC)
```

**Key design decisions:**

- **Auth-optional public data.** Market search, scores, and odds work without any authentication. Auth is only required for trading, portfolio access, and Kalshi-specific data.
- **Multi-layer fallbacks.** Every external API call has fallback paths (e.g., CLOB → Dome API, Gamma searchText → event browse, CDN → site API, multiple Polygon RPC endpoints for on-chain balance).
- **Self-chaining via `next_steps`.** Nearly every tool returns a `next_steps` array suggesting follow-up tool calls, making the AI assistant naturally chain from data discovery to trade execution.
- **HMR-safe credential store.** Session state lives on `globalThis` so credentials survive hot module reloads during development.

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm
- A Kalshi account with API keys (for trading/arbitrage)
- A Polymarket account with API credentials (for trading)

### Install and Run

```bash
# Clone the repo
git clone <repo-url>
cd mcp

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Fill in your API credentials (see Environment Variables below)

# Start the development server (with hot reload)
npm run dev

# Or build and run for production
npm run build
npm start
```

The server starts on **port 3000** and is accessible to any MCP client.

### Connect to an MCP Client

Point your MCP client at `http://localhost:3000`. In Claude Desktop, add to your MCP config:

```json
{
  "mcpServers": {
    "prediction-market-alpha": {
      "url": "http://localhost:3000"
    }
  }
}
```

---

## Environment Variables

Create a `.env` file from the template:

```bash
# Kalshi API Credentials
# Get from: https://kalshi.com → Settings → API Keys
KALSHI_API_KEY_ID=
KALSHI_PRIVATE_KEY_PATH=

# Polymarket Credentials
# Your Ethereum wallet private key (hex format)
POLYMARKET_PRIVATE_KEY=
# Your Polymarket proxy wallet address (from polymarket.com/settings)
POLYMARKET_FUNDER_ADDRESS=
```

| Variable | Required | Description |
|----------|----------|-------------|
| `KALSHI_API_KEY_ID` | For Kalshi trading/arb | API key ID from Kalshi Settings → API Keys |
| `KALSHI_PRIVATE_KEY_PATH` | For Kalshi trading/arb | Path to your RSA private key PEM file |
| `POLYMARKET_PRIVATE_KEY` | For Polymarket trading | Ethereum wallet private key (hex, with or without `0x`) |
| `POLYMARKET_FUNDER_ADDRESS` | For proxy wallets | Polymarket proxy wallet address from polymarket.com/settings |

You can also pass credentials at runtime through the `kalshi_login` and `polymarket_login_with_api_key` tools instead of using environment variables.

---

## Authentication

The server supports two authentication flows:

### Kalshi

Kalshi uses **RSA-PSS signature authentication**. You need an API key ID and an RSA private key (PEM format).

1. Go to [kalshi.com](https://kalshi.com) → Settings → API Keys
2. Generate a new API key — you'll get an API key ID and can download the private key
3. Either set the env vars or call the `kalshi_login` tool with the key ID and PEM content

The client signs every request with `SHA-256 + RSA-PSS` using the pattern `timestamp + METHOD + path`.

### Polymarket

Polymarket uses **EIP-712 signature authentication** via HMAC-signed L2 headers on the CLOB API.

1. You need your Ethereum wallet private key, plus CLOB API credentials (API key, secret, passphrase)
2. Optionally, your proxy wallet (funder) address from polymarket.com/settings
3. Call `polymarket_login_with_api_key` with all credentials

Market data (search, prices) works without authentication through the public Gamma API.

### Checking Auth Status

Call `auth_status` at any time to see which platforms are authenticated, current balances, and suggested next steps.

---

## Tools Reference

### Authentication Tools

#### `kalshi_login`

Authenticate with the Kalshi exchange. Required before any Kalshi-specific operations (trading, arbitrage scanning, portfolio).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `api_key_id` | string | Yes | Kalshi API key ID |
| `private_key_pem` | string | Yes | RSA private key in PEM format, raw base64, or a filesystem path |

Validates immediately by fetching your account balance. Supports PEM strings with or without headers, auto-fixes missing `-----END` markers, and can read from a file path on disk.

#### `polymarket_login_with_api_key`

Authenticate with Polymarket for trading and portfolio access.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `private_key` | string | Yes | Ethereum wallet private key (hex) |
| `api_key` | string | Yes | Polymarket CLOB API key |
| `secret` | string | Yes | Polymarket API secret (base64) |
| `passphrase` | string | Yes | Polymarket API passphrase |
| `funder_address` | string | No | Proxy wallet address (if using a proxy wallet) |

#### `auth_status`

Check authentication status and balances for both platforms. Returns which platforms are authenticated, current balances, and `next_steps` suggesting what to do if not yet logged in.

*No parameters.*

---

### Market Discovery Tools

#### `suggest_markets`

Surface tradeable prediction markets for any topic the user is discussing. Best for broad, conversational discovery.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `topic` | string | Yes | `"trending"` | Topic from conversation, or `"trending"` for highest-volume markets |
| `context` | string | No | — | Additional context about what the user is discussing |

Searches both Polymarket (Gamma API) and Kalshi (Dome API) simultaneously, deduplicates by event, filters closed/inactive markets, and caps results at 8. Combo/parlay markets are excluded.

#### `search_markets`

Search for specific prediction markets by query string. Use when the user has a specific event in mind.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search query (e.g., "Lakers vs Celtics", "Will Bitcoin hit $100K") |
| `platform` | `kalshi` \| `polymarket` \| `both` | Yes | `"both"` | Which platform(s) to search |
| `limit` | number | Yes | `20` | Max results per platform |
| `include_combo` | boolean | Yes | `false` | Include combo/parlay-style markets |

#### `get_market`

Get detailed info on a specific market — prices, volume, liquidity, token IDs, close time, rules, and resolution source.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `platform` | `kalshi` \| `polymarket` | Yes | Which platform |
| `market_id` | string | Yes | Kalshi ticker (e.g., `NBAGSW-25FEB21-LAL`) or Polymarket market ID/slug |

Kalshi requires authentication. Polymarket works without auth.

#### `get_orderbook`

Get orderbook depth — bids and asks at each price level — with best bid/ask and spread.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `platform` | `kalshi` \| `polymarket` | Yes | Which platform |
| `market_id` | string | Yes | Kalshi ticker or Polymarket token ID |

Returns top 10 price levels for Kalshi. For Polymarket, attempts the authenticated CLOB API first; falls back to Dome API price data if unauthenticated.

---

### Portfolio Management Tools

#### `get_balance`

Get cash balance on one or both platforms.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `platform` | `kalshi` \| `polymarket` \| `both` | Yes | `"both"` | Which platform(s) |

For Polymarket, returns a breakdown of bridged USDC.e and native USDC with a combined total. Checks on-chain balances via Polygon RPC with 3-provider failover.

#### `get_positions`

Get open positions and P&L per market.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `platform` | `kalshi` \| `polymarket` \| `both` | Yes | `"both"` | Which platform(s) |

Returns position details including exposure, realized P&L, fees, resting orders (Kalshi), and share counts with redeemable status (Polymarket). Falls back to Dome API for Polymarket positions if the direct client fails.

#### `portfolio_summary`

Unified portfolio overview across both platforms — total value, P&L, risk exposure, position count.

*No parameters.* Fetches balances and positions from both platforms in parallel and aggregates into a single cross-platform view with suggested next steps.

---

### Order Execution Tools

#### `place_order`

Place a buy or sell order on Kalshi or Polymarket.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `platform` | `kalshi` \| `polymarket` | Yes | — | Which platform |
| `market_id` | string | Yes | — | Kalshi ticker or Polymarket token ID |
| `side` | `yes` \| `no` | Yes | — | Which outcome to trade |
| `action` | `buy` \| `sell` | Yes | — | Buy or sell contracts |
| `quantity` | number | Yes | — | Number of contracts (min: 1) |
| `price` | number | Yes | — | Limit price as decimal (0.55 = 55¢). **Set to 0 for auto-pricing at best ask** (instant fill). |
| `order_type` | `limit` \| `market` | Yes | `"limit"` | Limit or market order |

**Auto-pricing:** When `price=0` or `order_type=market`, the tool fetches the current best ask and prices your order to fill instantly.

**Depth warnings:** For orders of 10+ contracts, the tool checks orderbook depth and warns if your quantity exceeds 2x the available liquidity at the best price.

Kalshi orders are always placed as limit orders (no native market orders). Polymarket uses GTC for limit orders and FOK for market orders via the CLOB API.

#### `cancel_order`

Cancel an open order on either platform.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `platform` | `kalshi` \| `polymarket` | Yes | Which platform |
| `order_id` | string | Yes | The order ID to cancel |

---

### ESPN Sports Data Tools

All ESPN tools work without any authentication.

#### `live_scores`

Get live scores, game status, schedule, and odds from ESPN.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `league` | enum | Yes | — | One of: `nfl`, `nba`, `mlb`, `nhl`, `ncaaf`, `ncaab`, `wnba`, `mls`, `epl`, `laliga`, `ufc`, `f1`, `pga` |
| `date` | string | No | Today | Date filter in `YYYYMMDD` format |

Returns per-game data including teams, scores, game clock, period, status (live/final/upcoming), spread, over/under, and moneylines. Proactively suggests related prediction markets and arbitrage scans.

#### `player_stats`

Get player statistics and overview from ESPN.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `player_name` | string | Yes | — | Player name to search (e.g., "Patrick Mahomes") |
| `league` | enum | Yes | `"nfl"` | The league the player is in |

Uses fuzzy name matching against the ESPN player database.

#### `game_summary`

Get a detailed game summary — box score, play-by-play, leaders, and situation data.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `league` | enum | Yes | The league |
| `event_id` | string | Yes | ESPN event ID (from `live_scores` results) |

#### `espn_odds`

Get sportsbook odds with vig-removed implied probabilities. Designed for comparing against prediction market prices to identify edges.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `league` | enum | Yes | The league |
| `event_id` | string | Yes | ESPN event ID (from `live_scores` results) |

For each sportsbook provider, returns home/away moneylines, raw implied probabilities, and **fair probabilities** (after removing the vig). This is the key data for edge analysis.

---

### Arbitrage & Edge Detection Tools

#### `scan_arbitrage`

The main arbitrage scanner. Finds cross-platform arbitrage (Kalshi vs Polymarket) and multi-outcome mispricing opportunities. **Requires Kalshi authentication.**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `category` | enum | Yes | `"all"` | `nfl`, `nba`, `mlb`, `nhl`, `ncaaf`, `ncaab`, `politics`, `economics`, `crypto`, or `all` |
| `min_edge` | number | Yes | `0.005` | Minimum edge as decimal (0.005 = 0.5%). Lower values return more results. |
| `max_results` | number | Yes | `15` | Maximum opportunities to return |
| `use_search` | boolean | Yes | `true` | Enable search-based matching (slower, but finds more matches) |
| `example_stake` | number | Yes | `50` | Example stake in dollars for profit projections |

Runs a **5-phase pipeline**:
1. **Parallel fetch** — pulls markets from both platforms by category (Kalshi series tickers, Polymarket tag IDs)
2. **Fuzzy matching** — entity-aware weighted scoring across platforms (threshold: 0.30 confidence)
3. **Search-based matching** — for unmatched Kalshi markets, queries Polymarket's searchText API, plus Dome API pre-computed cross-platform pairs
4. **Arbitrage detection** — checks both trade directions (Buy YES Kalshi + Buy NO Poly, and vice versa) for combined cost < $1
5. **Event mispricing scan** — finds multi-outcome events where outcome prices don't sum to $1 on either platform

Returns a markdown summary table, top-3 detailed trade plans with position sizing, and structured opportunity data.

#### `scan_mispricing`

Find single-platform events where outcome prices don't sum to $1.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `platform` | `kalshi` \| `polymarket` \| `both` | Yes | `"both"` | Which platform(s) to scan |
| `min_edge` | number | Yes | `0.005` | Minimum edge as decimal |
| `max_results` | number | Yes | `15` | Max opportunities |
| `example_stake` | number | Yes | `50` | Stake for profit projection |

For N mutually exclusive outcomes that should sum to $1.00:
- If sum < $1 → buy all YES outcomes for guaranteed profit
- If sum > $1 → buy all NO outcomes for guaranteed profit

Polymarket prices include a 2% spread buffer since displayed prices are midpoints, not executable.

#### `analyze_edge`

Deep-dive edge analysis on a single market. Compares the prediction market price against ESPN sportsbook implied probabilities.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `platform` | `kalshi` \| `polymarket` | Yes | Which platform |
| `market_id` | string | Yes | Market ticker or slug |
| `espn_event_id` | string | No | ESPN event ID for sportsbook comparison |
| `espn_league` | string | No | League for ESPN lookup (`nfl`, `nba`, `mlb`, `nhl`, `ncaaf`, `ncaab`) |

Returns market prices, implied probabilities, spread, volume, and — when ESPN data is provided — a side-by-side comparison of market price vs vig-free sportsbook fair probability.

#### `quick_arb`

End-to-end arbitrage: scan, find the best opportunity, size the position, and execute both legs.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `category` | enum | Yes | `"all"` | Category to scan |
| `max_stake` | number | Yes | `50` | Maximum total stake in dollars across both platforms |
| `dry_run` | boolean | Yes | `true` | Preview without executing. **Set to `false` for real orders.** |

**Always start with `dry_run=true`.** The tool runs the full scan + match pipeline, finds the highest-edge opportunity, calculates position sizing (accounting for Kalshi's ~7% profit fee), and returns a detailed trade plan.

In live mode (`dry_run=false`), it places the Kalshi order first. If the Kalshi leg fails, the Polymarket leg is skipped to avoid one-sided exposure. Returns order IDs, fill status, and net profit.

---

## Widgets

Four interactive React widgets render inline in the MCP client UI. They use `mcp-use/react`'s `useWidget` hook with Zod-validated props.

### Arbitrage Scanner

Displays scan results with edge-percentage bar visualization color-coded by magnitude, per-opportunity cards (best opportunity highlighted), max-stake input, and **Execute buttons** that call `quick_arb` directly from the UI with a confirm/cancel flow.

### Portfolio Dashboard

Unified portfolio view with platform summary cards (Kalshi in blue, Polymarket in purple), filterable tab bar (All / Kalshi / Polymarket), a positions table with P&L badges, and aggregate statistics.

### Live Scores

Sports scoreboard widget with live/upcoming/final game cards. Live games show a pulsing red indicator, scores display with the winning team bolded, and an odds footer shows spread, over/under, and moneylines.

### Trade Confirmation

Post-execution summary showing guaranteed profit, edge percentage, ROI, total cost, per-platform order cards with fill details, execution status badges, error display for partial executions, and a dry-run warning banner.

---

## Library Internals

### Kalshi Client

`lib/kalshi/client.ts` — Authenticated REST client for the Kalshi elections API (v2).

- **Authentication:** RSA-PSS signature (`timestamp + METHOD + path` signed with SHA-256)
- **PEM handling:** Normalizes missing END markers, raw base64, one-line PEMs, and file paths
- **Signing fallback:** Tries `/trade-api/v2/path` first, falls back to just `/path` on 401 to handle API prefix mismatches
- **Methods:** `getBalance`, `getPositions`, `getMarkets`, `getMarket`, `getOrderbook`, `getEvents`, `createOrder`, `cancelOrder`, `getOrders`

### Polymarket Client

`lib/polymarket/client.ts` — Multi-API client spanning three Polymarket services.

- **Gamma API** (public, no auth) — `searchEvents`, `searchMarkets`, `getMarket`, `searchText`
- **CLOB API** (L2 auth with HMAC-SHA256) — `getPrice`, `getMidpoint`, `getOrderbook`, `placeOrder`, `cancelOrder`, `getOpenOrders`, `getExchangeCollateral`
- **Data API** (public, no auth) — `getPositions`, `getTrades`
- **Balance checking:** Tries CLOB exchange collateral first, falls back to on-chain ERC-20 `balanceOf` via Polygon RPC with 3-provider failover (polygon-rpc.com, ankr, publicnode)
- **Static helper:** `parseMarketFields` handles Gamma's inconsistent JSON-string-or-array field encoding

### ESPN Client

`lib/espn/client.ts` — Client for the ESPN public API across 13 leagues.

Supports: NFL, NBA, MLB, NHL, NCAAF, NCAAB, WNBA, MLS, EPL, La Liga, UFC, F1, PGA.

- **Endpoints:** Scoreboard, game summary, odds, player overview (with fallback endpoint), player gamelog, player search, teams, standings, news, and a CDN-backed live scoreboard with graceful fallback
- **League mapping:** `SPORT_LEAGUE_MAP` maps league keys to ESPN sport/league URL paths

### Dome Client

`lib/dome/client.ts` — Third-party market aggregation API (domeapi.io).

Used as a supplementary data source and fallback:
- Unified market search across platforms
- Pre-computed cross-platform market matching (critical for arbitrage)
- Polymarket position and price data as a fallback when CLOB is unavailable

### Arbitrage Engine

`lib/arbitrage/engine.ts` — Profit calculation and opportunity detection.

- **`findArbitrageOpportunities`** — For each matched market pair, checks both trade directions: (Buy YES Kalshi + Buy NO Polymarket) and (Buy NO Kalshi + Buy YES Polymarket). Edge = `1.0 - combined_cost`. Opportunity exists when edge > threshold.
- **`calculateProfit`** — Fee-aware profit breakdown accounting for Kalshi's ~7% profit fee. Returns contract counts, per-leg costs, gross/net profit, and ROI.
- **`sizePosition`** — Determines optimal position size given max stake and orderbook depth.

### Cross-Platform Matcher

`lib/arbitrage/matcher.ts` — Entity-aware fuzzy matching engine for pairing the same event across Kalshi and Polymarket.

**Weighted scoring algorithm:**
| Signal | Weight | Description |
|--------|--------|-------------|
| String similarity | 25% | Overall title similarity |
| Keyword overlap | 30% | Shared keywords (stop-words filtered) |
| Number matching | 20% | Matching numbers/thresholds (strongest signal) |
| Proper noun matching | 15% | Shared proper nouns and entities |
| Abbreviation matching | 10% | Abbreviation expansion (e.g., "NFL" ↔ "National Football League") |

Markets with high entity overlap shortcut to 85%+ confidence. The system uses three independent matching strategies — fuzzy, search-based (querying Polymarket's searchText API), and Dome API pre-computed pairs — then deduplicates the combined results.

### Utilities

**`lib/utils/session.ts`** — Global credential store using `globalThis.__mcpCreds` for HMR-safe persistence. Single-user deployment model. Exports `getSession`, `setKalshiSession`, `setPolymarketSession`, and clear functions. Includes `hydrateClients` to re-instantiate client prototypes after serialization.

**`lib/utils/normalize.ts`** — Cross-platform price conversion:
- `kalshiCentsToDecimal` / `decimalToKalshiCents` — Kalshi uses integer cents (1–99), Polymarket uses decimals (0.01–0.99)
- `moneylineToImpliedProb` — Converts American moneyline odds to implied probability
- `removeVig` — Strips sportsbook vig to produce fair probabilities
- `formatDollars`, `formatPercent`, `formatPnl` — Display formatters

**`lib/utils/ctx.ts`** — Extracts session ID from `ToolContext`, falling back to `'default'`. Defensive against varying `mcp-use` context shapes.

---

## Intent Routing

The server description embeds an intent-routing system that instructs the AI assistant how to classify user messages and chain tool calls. The six routing categories:

| User Intent | Primary Tools | Follow-up Chain |
|-------------|--------------|-----------------|
| **Real-world topic / news / opinion** | `suggest_markets(topic)` | → `live_scores` → `espn_odds` → `search_markets` → `place_order` |
| **Money / profit intent** | `suggest_markets("trending")`, `scan_arbitrage("all")` | → `scan_mispricing` → `quick_arb(dry_run)` |
| **Sports questions** | `live_scores`, `player_stats`, `game_summary` | → `search_markets` → `espn_odds` → `analyze_edge` |
| **Arbitrage / trading** | `auth_status` → `scan_arbitrage` | → `scan_mispricing` → `quick_arb(dry_run)` |
| **Portfolio / account** | `portfolio_summary` | → `get_positions` → `get_balance` |
| **Specific market lookup** | `get_market`, `get_orderbook` | → `analyze_edge` |

The **chaining principle**: never stop at one tool call. After every result, determine what would help the user act on the data and call the next tool.

---

## Project Structure

```
.
├── index.ts                          # Server entry point — config, routing description, startup
├── package.json                      # Dependencies and scripts
├── tsconfig.json                     # TypeScript config (ES2022, strict, JSX)
├── .env.example                      # Environment variable template
│
├── tools/
│   ├── index.ts                      # Tool registration orchestrator
│   ├── auth.ts                       # kalshi_login, polymarket_login_with_api_key, auth_status
│   ├── markets.ts                    # suggest_markets, search_markets, get_market, get_orderbook
│   ├── portfolio.ts                  # get_balance, get_positions, portfolio_summary
│   ├── trading.ts                    # place_order, cancel_order
│   ├── espn.ts                       # live_scores, player_stats, game_summary, espn_odds
│   └── arbitrage.ts                  # scan_arbitrage, scan_mispricing, analyze_edge, quick_arb
│
├── resources/
│   ├── arbitrage-scanner/
│   │   └── widget.tsx                # Arbitrage opportunity scanner UI
│   ├── portfolio-dashboard/
│   │   └── widget.tsx                # Unified portfolio view UI
│   ├── live-scores/
│   │   └── widget.tsx                # ESPN live scoreboard UI
│   └── trade-confirmation/
│       └── widget.tsx                # Post-trade execution summary UI
│
└── lib/
    ├── kalshi/
    │   ├── client.ts                 # Kalshi REST API client (RSA-PSS auth)
    │   └── types.ts                  # Kalshi type definitions
    ├── polymarket/
    │   ├── client.ts                 # Polymarket Gamma/CLOB/Data API client
    │   └── types.ts                  # Polymarket type definitions
    ├── espn/
    │   ├── client.ts                 # ESPN public API client (13 leagues)
    │   └── types.ts                  # ESPN type definitions and league map
    ├── dome/
    │   └── client.ts                 # Dome aggregation API client
    ├── arbitrage/
    │   ├── matcher.ts                # Cross-platform fuzzy market matching
    │   └── engine.ts                 # Arbitrage detection and profit calculation
    └── utils/
        ├── session.ts                # HMR-safe global credential store
        ├── ctx.ts                    # MCP context / session ID extraction
        └── normalize.ts              # Price conversion and formatting utilities
```

---

## Development

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Deploy (mcp-use hosting)
npm run deploy
```

### Tech Stack

| Technology | Purpose |
|------------|---------|
| [mcp-use](https://mcp-use.com) | MCP server framework (tools, resources, routing) |
| TypeScript 5.7+ | Language (strict mode, ES2022 target) |
| [ethers](https://docs.ethers.org/v6/) v6 | Ethereum wallet operations, EIP-712 signing for Polymarket |
| [Zod](https://zod.dev) v4 | Schema validation for tool inputs and widget props |
| [string-similarity](https://github.com/aceakash/string-similarity) | Dice coefficient for cross-platform market matching |
| React (JSX) | Interactive widget rendering via `mcp-use/react` |

### Adding a New Tool

1. Create or edit a file in `tools/`
2. Define the tool with `server.tool(name, description, schema, handler)`
3. Use Zod for parameter validation
4. Return structured data with a `next_steps` array
5. Register in `tools/index.ts` if it's a new file

### Adding a New Widget

1. Create a directory in `resources/` with a `widget.tsx`
2. Define props with a Zod schema
3. Use `useWidget()` from `mcp-use/react` for props and tool calling
4. The widget auto-registers via the `mcp-use` framework

---

## Technical Design Notes

### Cross-Platform Price Normalization

Kalshi quotes prices in integer cents (1–99) while Polymarket uses decimals (0.01–0.99). All arbitrage calculations normalize to decimals at the boundary, and the `normalize.ts` utilities handle bidirectional conversion.

### Arbitrage Fee Accounting

Kalshi charges a ~7% fee on profits. The arbitrage engine accounts for this in all profit calculations, so the reported edge and ROI numbers reflect actual take-home profit, not gross.

### Polymarket Midpoint vs Executable Price

Polymarket's displayed prices are midpoints (average of best bid and best ask), not directly executable prices. The mispricing scanner applies a 2% spread buffer to avoid false positives. Always verify with `get_orderbook` before executing.

### Session Architecture

The server uses a single-user deployment model. Credentials are stored in `globalThis.__mcpCreds` to survive hot module reloads. The session system ignores MCP session IDs entirely — all requests share the same credential store. This is intentional for personal/local use.

### Matching Quality

The cross-platform matcher combines three independent strategies to maximize recall:
1. **Fuzzy matching** — O(N×M) pairwise comparison on pre-fetched market lists
2. **Search-based matching** — queries Polymarket's text search API with extracted terms from each unmatched Kalshi market
3. **Dome API matching** — leverages pre-computed cross-platform pairs from the Dome aggregator

Results from all three are deduplicated, producing a higher match rate than any single strategy alone.

### Error Resilience

The server is designed to degrade gracefully:
- If Dome API is down, falls back to direct platform APIs
- If Polymarket CLOB is unavailable, falls back to Gamma API for data and Dome for prices
- If one Polygon RPC node fails, tries the next (3-provider rotation)
- If a player overview endpoint 404s, tries an alternate ESPN API path
- Partial arbitrage scan failures are logged but don't abort the entire scan
- If the Kalshi leg of a `quick_arb` execution fails, the Polymarket leg is skipped to prevent one-sided exposure
