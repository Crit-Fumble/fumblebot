/**
 * MCP Handler Types
 * Shared types for all MCP tool handlers
 */

/** Content item in MCP response */
export interface MCPContentItem {
  type: 'text' | 'image';
  text?: string;
  data?: string;
  mimeType?: string;
}

/** MCP tool result - compatible with SDK's CallToolResult */
export interface MCPToolResult {
  [x: string]: unknown;
  content: MCPContentItem[];
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

/** Handler interface */
export interface MCPHandler {
  handle(name: string, args: any): Promise<MCPToolResult>;
}
