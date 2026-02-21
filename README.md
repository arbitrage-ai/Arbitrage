# Arbitrage AI — MCP Server

An MCP server for managing **Kalshi** and **Polymarket** prediction market portfolios, detecting **arbitrage** opportunities across platforms, and leveraging **ESPN** real-time game data — all accessible inside ChatGPT.

Built with the [mcp-use](https://github.com/mcp-use/mcp-use) framework.

## Features

### Kalshi Integration
- **Portfolio management** — view balance, positions, and P&L
- **Market search** — find markets by keyword
- **Market odds** — get real-time YES/NO prices for any market
- **Trading** — place market and limit orders
- **Order history** — review past trades

### Polymarket Integration
- **Portfolio management** — view holdings and performance
- **Market search** — browse active prediction markets
- **Market odds** — get token prices and liquidity data
- **Trading** — buy/sell outcome shares
- **Community comments** — read market discussion for sentiment analysis
- **Order history** — review past trades

### Arbitrage Detection
- **Compare odds** — side-by-side price comparison between Kalshi and Polymarket
- **Find arbitrage** — detect risk-free profit opportunities when combined prices < $1.00
- **Calculate profit** — model potential returns for any trade

### ESPN Data
- **Live scores** — real-time scores, game clock, and period for NFL, NBA, MLB, NHL, college sports, and more
- **Game details** — play-by-play situation data (down, distance, possession, red zone) for early information edge
- **Game odds** — sportsbook lines (spread, moneyline, over/under) to compare with prediction market prices
- **Scoreboard** — full league schedules and results

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Development (with hot reload and inspector)
npm run dev

# Production
npm run build
npm run start
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `KALSHI_API_KEY` | For Kalshi trading | Your Kalshi API key |
| `POLYMARKET_API_KEY` | For Polymarket trading | Your Polymarket API key |
| `KALSHI_API_URL` | No | Custom Kalshi API URL (defaults to production) |
| `POLYMARKET_API_URL` | No | Custom Polymarket API URL (defaults to production) |
| `POLYMARKET_CLOB_URL` | No | Custom Polymarket CLOB URL (defaults to production) |
| `ESPN_API_URL` | No | Custom ESPN API URL |
| `MCP_URL` | No | Server base URL (defaults to `http://localhost:3000`) |

> **Note:** ESPN data and market search work without API keys. API keys are only required for portfolio management and trading.

## MCP Tools

| Tool | Description |
|---|---|
| `kalshi-get-portfolio` | Get Kalshi portfolio (balance, positions, P&L) |
| `kalshi-get-positions` | Get current Kalshi positions |
| `kalshi-get-market-odds` | Get odds for a specific Kalshi market |
| `kalshi-search-markets` | Search Kalshi markets by keyword |
| `kalshi-place-trade` | Place a trade on Kalshi |
| `kalshi-get-order-history` | Get Kalshi order history |
| `polymarket-get-portfolio` | Get Polymarket portfolio |
| `polymarket-get-positions` | Get current Polymarket positions |
| `polymarket-get-market-odds` | Get Polymarket market odds |
| `polymarket-search-markets` | Search Polymarket markets |
| `polymarket-place-trade` | Place a trade on Polymarket |
| `polymarket-get-order-history` | Get Polymarket order history |
| `polymarket-get-comments` | Get community comments for a market |
| `espn-get-live-scores` | Get live scores for a league |
| `espn-get-scoreboard` | Get full scoreboard for a league |
| `espn-get-game-details` | Get detailed game info with live situation |
| `espn-get-game-odds` | Get sportsbook odds for games |
| `compare-odds` | Compare Kalshi vs Polymarket odds |
| `find-arbitrage` | Find cross-platform arbitrage opportunities |
| `calculate-profit` | Calculate potential trade profit/loss |

## Connecting to ChatGPT

The server exposes an MCP endpoint at `http://localhost:3000/mcp`. Connect any MCP-compatible client:

```json
{
  "mcpServers": {
    "arbitrage-ai": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Development

```bash
npm run dev      # Start dev server with hot reload + inspector
npm run build    # Build for production
npm run start    # Start production server
npm test         # Run tests
```

## License

MIT