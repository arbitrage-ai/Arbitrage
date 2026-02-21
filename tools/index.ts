import type { McpServerInstance } from 'mcp-use/server';
import { registerAuthTools } from './auth.js';
import { registerPortfolioTools } from './portfolio.js';
import { registerMarketTools } from './markets.js';
import { registerTradingTools } from './trading.js';
import { registerESPNTools } from './espn.js';
import { registerArbitrageTools } from './arbitrage.js';

export function registerAllTools(server: McpServerInstance): void {
  registerAuthTools(server);
  registerPortfolioTools(server);
  registerMarketTools(server);
  registerTradingTools(server);
  registerESPNTools(server);
  registerArbitrageTools(server);
}
