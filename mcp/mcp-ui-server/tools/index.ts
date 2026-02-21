import type { McpServerInstance } from 'mcp-use/server';
import { registerAuthTools } from './auth.js';
import { registerPortfolioTools } from './portfolio.js';

export function registerAllTools(server: McpServerInstance): void {
  registerAuthTools(server);
  registerPortfolioTools(server);
}
