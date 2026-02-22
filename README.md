<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/icon.svg">
    <img alt="Prediction Market Alpha" src="public/icon.svg" width="80">
  </picture>
</p>

<h1 align="center">Arbitrage</h1>

<p align="center">
  MCP server for prediction market trading across Kalshi and Polymarket with live ESPN sports data.
</p>

<p align="center">
  <a href="#tools">Tools</a> ·
  <a href="#widgets">Widgets</a> ·
  <a href="#architecture">Architecture</a>
</p>

---

## Overview

Arbitrage is an MCP server that gives AI tools access to prediction market prices, sportsbook odds, and cross-platform arbitrage detection. It connects to Kalshi, Polymarket, and ESPN's public API, then exposes tools for market search, arbitrage scanning, and order execution.

The server handles three problems:

1. **Cross-platform arbitrage** — Matches equivalent markets across Kalshi and Polymarket using fuzzy text similarity, proper noun extraction, and Dome's pre-computed pairs. When prices disagree, the system calculates fee-aware profit (accounting for Kalshi's ~7% net profit fee) and can execute both legs.

2. **Single-platform mispricing** — Scans multi-outcome events where the sum of all YES prices is less than $1. Buying every outcome guarantees a payout above the cost.

3. **Sports-informed edge** — Compares ESPN win probabilities and sportsbook odds against prediction market prices to surface divergences.

---

## Scenario

What should you do when you need $20? Well, you should tell AI you need $20. It calls `scan_arbitrage`, pulls live markets from both platforms, and compares prices against ESPN win probabilities.

It finds Eagles vs 49ers — 2:15 left, Eagles down 3. ESPN just recalculated their win probability to 41%, but Kalshi is still pricing Eagles YES at 40¢. That gap closes in seconds.

```
ESPN win probability:  41%
Kalshi YES price:      40¢  (lagging ~3 seconds)

1¢ edge per contract.
1000 contracts at 40¢ → Kalshi reprices to 41¢ → exit at 41¢.
Profit: $10.
```

It catches a second spike on a Celtics game. Nets $12.

```
AI tools: Done. Caught two spikes across Eagles-49ers and Celtics.
        1000 Eagles contracts at 40¢, sold at 41¢ (+$10).
        Celtics spike (+$12).
        Total: $22. Your $20 is covered.
```

ESPN moved faster than Kalshi by 2–3 seconds. The server detected the divergence, sized the position, and executed before the market repriced.

---

<h2 id="tools">Tools</h2>

| Category | Tool | Description |
|----------|------|-------------|
| **Auth** | `kalshi_login` | Authenticate with Kalshi (RSA key pair) |
| | `polymarket_login_with_api_key` | Authenticate with Polymarket (ETH wallet + API creds) |
| | `auth_status` | Check auth state and balances |
| **Markets** | `suggest_markets` | Surface tradeable markets for a given topic |
| | `search_markets` | Search markets on Kalshi and/or Polymarket |
| | `get_market` | Market details: prices, volume, token IDs |
| | `get_orderbook` | Orderbook depth at each price level |
| **ESPN** | `live_scores` | Scores and schedule across 13 leagues |
| | `player_stats` | Player statistics and game log |
| | `game_summary` | Box scores, play-by-play, game leaders |
| | `espn_odds` | Sportsbook lines with implied probabilities |
| **Arbitrage** | `scan_arbitrage` | Cross-platform arb scan (Kalshi × Polymarket) |
| | `scan_mispricing` | Multi-outcome mispricing on a single platform |
| | `analyze_edge` | Compare market price vs ESPN odds |
| | `quick_arb` | Find and execute best arb (dry run or live) |
| **Trading** | `place_order` | Buy/sell on either platform (limit or market) |
| | `cancel_order` | Cancel an open order |
| **Portfolio** | `get_balance` | Cash balance on one or both platforms |
| | `get_positions` | Open positions and P&L |
| | `portfolio_summary` | Unified view across both platforms |

---

<h2 id="widgets">Widgets</h2>

Six React widgets render inside the chat and communicate bidirectionally with AI tools — the model sends structured data to the widget, and buttons in the widget call MCP tools back through AI tools.

| Widget | Function |
|--------|----------|
| **Arbitrage Scanner** | Displays opportunities as cards with edge, ROI, and per-contract profit. Includes an execute button that triggers `quick_arb` with a confirmation step. Adjustable stake input. |
| **Auth Login** | Credential entry for Kalshi and Polymarket authentication. |
| **Live Scores** | ESPN scoreboard with game cards. Live games show a status indicator. Displays spreads, over/under, and moneyline odds. |
| **Order Entry** | Direct order placement interface for either platform. |
| **Portfolio Dashboard** | Positions across both platforms with balance, exposure, and P&L. Filterable by platform. |
| **Trade Confirmation** | Post-execution summary: profit, edge, ROI, cost breakdown, per-platform orders, and execution status. Dry runs show a warning banner. |

---

<h2 id="architecture">Architecture</h2>

```
├── index.ts                    # Server entry, intent-routing prompt
├── tools/
│   ├── auth.ts                 # Kalshi RSA + Polymarket ETH auth
│   ├── markets.ts              # Market search (Dome + Gamma APIs)
│   ├── espn.ts                 # ESPN live data (13 leagues)
│   ├── arbitrage.ts            # Cross-platform arb + mispricing
│   ├── trading.ts              # Order placement and cancellation
│   └── portfolio.ts            # Balance, positions, portfolio summary
├── lib/
│   ├── kalshi/                 # Kalshi REST client (RSA-signed requests)
│   ├── polymarket/             # Polymarket CLOB + Gamma API client
│   ├── espn/                   # ESPN public API client
│   ├── dome/                   # Dome cross-platform market data
│   └── arbitrage/
│       ├── engine.ts           # Arb detection, fee-aware profit calc
│       └── matcher.ts          # Multi-signal fuzzy market matching
├── resources/
│   ├── arbitrage-scanner/      # Scan results widget
│   ├── auth-login/             # Auth credential widget
│   ├── live-scores/            # ESPN scoreboard widget
│   ├── order-entry/            # Order placement widget
│   ├── portfolio-dashboard/    # Portfolio widget
│   └── trade-confirmation/     # Execution summary widget
└── public/
    └── icon.svg
```

### Design notes

**Intent routing.** The server description in `index.ts` includes a full intent classifier. AI tools selects tools based on user intent without additional client-side prompting.

**Market matching.** Matching "Will the Eagles win?" (Kalshi) to "Philadelphia Eagles to win NFC Championship" (Polymarket) requires more than string comparison. The matcher combines string similarity, proper noun extraction, number matching, and abbreviation detection. Dome's API provides pre-computed pairs as a third matching layer.

**Session auth.** Credentials are held in memory per session. Nothing is written to disk. Private keys are validated on login via a test API call.

---

## Stack

- [mcp-use](https://mcp-use.com) — This project exists because of mcp-use. Their framework handles the entire MCP server lifecycle — tool registration, typed schemas, bidirectional widget rendering, deployment — so we could focus entirely on the trading logic. What would have been weeks of protocol plumbing was a single afternoon.
- [Kalshi API](https://trading-api.readme.io/) — CFTC-regulated prediction market
- [Polymarket CLOB](https://docs.polymarket.com/) — Prediction market on Polygon
- [ESPN API](https://site.api.espn.com/) — Live sports data
- [Dome API](https://docs.domeapi.com/) — Cross-platform market matching