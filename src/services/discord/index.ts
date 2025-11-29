/**
 * FumbleBot Discord Bot Module
 *
 * Exports all commands, components, and handlers for the Discord bot.
 */

import type { FumbleBotClient } from './client.js'

// Global reference to the bot client for API access
let fumbleBotClient: FumbleBotClient | null = null

/**
 * Set the global FumbleBot client reference
 * Called by server.ts when the bot starts
 */
export function setFumbleBotClient(client: FumbleBotClient | null): void {
  fumbleBotClient = client
}

/**
 * Get the global FumbleBot client reference
 * Used by voice API to access Discord client
 */
export function getFumbleBotClient(): FumbleBotClient | null {
  return fumbleBotClient
}

// Client export
export { FumbleBotClient } from './client.js'

// Slash commands and context menus
export * from './commands.js'

// Interactive components (embeds, buttons, modals)
export * from './components.js'
