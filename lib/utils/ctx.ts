/**
 * Extract a stable session ID from the tool context.
 * Uses the MCP session ID header set by the mcp-use transport layer.
 */
import type { ToolContext } from 'mcp-use/server';

export function getSessionId(ctx: ToolContext): string {
  // mcp-use sets Mcp-Session-Id on each request
  const sessionId =
    (ctx as any).req?.header?.('mcp-session-id') ||
    (ctx as any).req?.headers?.get?.('mcp-session-id') ||
    (ctx as any).sessionId ||
    'default';
  return sessionId as string;
}
