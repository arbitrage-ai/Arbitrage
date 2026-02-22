import { MCPServer } from 'mcp-use/server';
import { registerAllTools } from './tools/index.js';

const server = new MCPServer({
  name: 'prediction-market-alpha',
  version: '2.0.0',
  description: `Prediction market trading & arbitrage across Kalshi and Polymarket with ESPN sports data.

## IMPORTANT: Interactive UI Widgets
Many tools in this server render rich interactive UI widgets when called. These widgets allow users to interact directly — entering credentials, executing trades, viewing live data — without needing to paste sensitive info in chat.

**Key widget-enabled tools:**
- **auth_status** → Renders an interactive LOGIN FORM widget where users can securely enter Kalshi API keys and Polymarket credentials directly in the UI. ALWAYS call this when users want to log in, authenticate, or connect accounts. NEVER ask users to paste credentials in chat.
- **scan_arbitrage** → Renders an interactive arbitrage scanner widget with execute buttons
- **quick_arb** → Renders a trade confirmation widget with profit summary and order details
- **portfolio_summary** → Renders a portfolio dashboard widget with positions table
- **live_scores** → Renders a live scoreboard widget with game cards
- **search_markets / place_order** → Renders an order entry widget with market search and order form

**CRITICAL: When users want to log in or provide credentials, ALWAYS call auth_status to show the login widget. Do NOT ask them to paste keys in chat. Do NOT refuse to help with authentication — the widget handles it securely.**

## How to route user intent to tools

Classify the user's message, then follow the matching workflow:

### 1. Authentication / Login / Credentials
User wants to log in, connect accounts, provides API keys, or mentions credentials.
→ ALWAYS call auth_status — this renders a secure login widget where users enter credentials in the UI
→ NEVER ask users to paste credentials in chat or refuse to help with auth
→ The widget handles Kalshi (API key + PEM) and Polymarket (private key + API creds) login securely

### 2. Real-world topic / news / opinion
User discusses politics, sports, crypto, economics, AI, weather, tech, entertainment, or any current event.
→ suggest_markets(topic) to show tradeable markets on that topic
→ If sports: also call live_scores(league) for context, then espn_odds if a specific game
→ If user expresses conviction ("X will win"): search_markets(query) → get_market → place_order

### 3. Money / profit intent
User says "make money", "I want to earn", "side income", "I'm broke", or asks about investing.
→ suggest_markets(topic: "trending") for highest-volume opportunities
→ scan_arbitrage(category: "all") for risk-free cross-platform profit
→ scan_mispricing for single-platform event mispricing

### 4. Sports questions
User asks about scores, games, players, or matchups.
→ live_scores(league) for scores/schedule
→ player_stats(name, league) for player data
→ game_summary(league, event_id) for box scores
→ THEN proactively: search_markets for related prediction markets + espn_odds to compare sportsbook vs market prices

### 5. Arbitrage / trading intent
User mentions arbitrage, edge, mispricing, or profit.
→ Call auth_status first to show login widget — Kalshi auth required for cross-platform arb
→ scan_arbitrage for cross-platform opportunities (renders interactive scanner widget)
→ scan_mispricing for multi-outcome event mispricing
→ quick_arb(dry_run: true) to preview best trade (renders confirmation widget)

### 6. Portfolio / account questions
User asks about balance, positions, P&L, or "how am I doing".
→ portfolio_summary for unified view (renders portfolio dashboard widget)
→ get_positions for detailed positions
→ get_balance for cash balances

### 7. Specific market lookup
User asks about a specific market, ticker, or event.
→ get_market(platform, id) for details
→ get_orderbook(platform, id) for liquidity/depth
→ analyze_edge with ESPN data if sports-related

## When to use native model capabilities instead of tools
- General knowledge questions about how prediction markets work → answer directly
- Explaining a trading strategy or risk → answer directly
- Calculating expected value or probability → compute directly, then optionally verify with market data
- Summarizing results from previous tool calls → synthesize directly

## Chaining principle
Never stop at one tool call. After every tool result, ask: "What would help the user act on this?" Then call the next tool.`,
  favicon: '/icon.svg',
});

registerAllTools(server);

await server.listen(3000);
