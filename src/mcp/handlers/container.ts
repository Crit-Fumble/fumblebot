/**
 * Container Tool Handlers
 *
 * @deprecated Use adventure.ts handlers instead.
 * Container tools have been replaced by Adventure tools in Core SDK v10.13+.
 *
 * This handler is kept for backwards compatibility but all methods return deprecation errors.
 */

import type { MCPToolResult } from './types.js';

/**
 * @deprecated Use AdventureHandler instead
 */
export class ContainerHandler {
  async handle(name: string, _args: any): Promise<MCPToolResult> {
    // All container tools are deprecated
    const deprecationMessage = `The ${name} tool is deprecated. Use the adventure_* tools instead:\n` +
      '- adventure_create: Create a new adventure\n' +
      '- adventure_join: Join an adventure\n' +
      '- adventure_action: Send an action\n' +
      '- adventure_say: Send dialogue\n' +
      '- adventure_status: Get adventure status\n' +
      '- adventure_end: End an adventure';

    return {
      content: [
        {
          type: 'text',
          text: deprecationMessage,
        },
      ],
      isError: true,
    };
  }
}
