import { MCPServer } from 'mcp-use/server';
import { registerAllTools } from './tools/index.js';

const server = new MCPServer({
  name: 'predictedge-auth-ui',
  version: '1.0.0',
  description:
    'Login to Kalshi & Polymarket via MCP App UI. Provide your API keys, authenticate, and view your live portfolio across both prediction market platforms.',
  favicon: '/icon.svg',
});

registerAllTools(server);

await server.listen(3000);
