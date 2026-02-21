/**
 * Extract a stable session ID from the tool context.
 * Prefer the official ToolContext session API.
 */
import type { ToolContext } from 'mcp-use/server';

export function getSessionId(ctx: ToolContext): string {
  const anyCtx = ctx as any;
  if (
    typeof anyCtx?.session?.sessionId === 'string' &&
    anyCtx.session.sessionId.length > 0
  ) {
    return anyCtx.session.sessionId;
  }

  if (typeof anyCtx?.sessionId === 'string' && anyCtx.sessionId.length > 0) {
    return anyCtx.sessionId;
  }

  return 'default';
}
