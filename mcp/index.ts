import { MCPServer } from 'mcp-use/server';
import { registerAllTools } from './tools/index.js';

const server = new MCPServer({
  name: 'betting-edge-analyzer',
  version: '1.0.0',
  description:
    'Sports betting edge analyzer: manage Kalshi & Polymarket portfolios, execute trades, find cross-platform arbitrage, and leverage ESPN real-time data for information edge. Go from auth to profit in 3 minutes.',
  favicon: '/icon.svg',
});

registerAllTools(server);

await server.listen(3000);
