/**
 * Extract a stable session ID from the tool context.
 * Prefer the official ToolContext session API.
 */
import type { ToolContext } from 'mcp-use/server';
export declare function getSessionId(ctx: ToolContext): string;
