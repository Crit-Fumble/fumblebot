/**
 * Command Types
 * Type definitions for command handlers
 */

import type { ChatInputCommandInteraction } from 'discord.js'
import type { FumbleBotClient } from '../client.js'

export type CommandHandler = (
  interaction: ChatInputCommandInteraction,
  bot: FumbleBotClient
) => Promise<void>

export interface CommandResponse {
  content?: string
  embeds?: any[]
  components?: any[]
  ephemeral?: boolean
  files?: any[]
}
