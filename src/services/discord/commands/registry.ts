/**
 * Command Registry
 * Manages all slash commands and their handlers
 */

import {
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js'
import type { CommandHandler } from './types.js'

// Import command modules
import { diceCommands, diceHandler } from './slash/dice.js'

export class CommandRegistry {
  private slashCommands: Map<string, SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder> = new Map()
  private slashHandlers: Map<string, CommandHandler> = new Map()

  constructor() {
    this.registerAllCommands()
  }

  private registerAllCommands(): void {
    // Register slash commands
    this.registerSlashCommands(diceCommands, diceHandler)
  }

  private registerSlashCommands(
    commands: (SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder)[],
    handler: CommandHandler
  ): void {
    for (const command of commands) {
      this.slashCommands.set(command.name, command)
      this.slashHandlers.set(command.name, handler)
    }
  }

  /**
   * Get a slash command handler by name
   */
  getSlashHandler(name: string): CommandHandler | undefined {
    return this.slashHandlers.get(name)
  }

  /**
   * Get all commands as JSON for Discord API registration
   */
  getCommandsJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    return Array.from(this.slashCommands.values()).map((cmd) => cmd.toJSON())
  }

  /**
   * Get command count
   */
  get commandCount(): number {
    return this.slashCommands.size
  }
}
