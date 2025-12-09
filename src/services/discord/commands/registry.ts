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
import { voiceCommands, voiceHandler } from './slash/voice.js'
import { settingsCommands, settingsHandler } from './slash/settings.js'
import { characterCommands, characterHandler } from './slash/character.js'
import { icCommands, icHandler } from './slash/ic.js'
import { timestampCommands, timestampHandler } from './slash/timestamp.js'
import { aiGenerateCommands, aiGenerateHandler } from './slash/ai-generate.js'
import { eventCommands, eventHandler } from './slash/event.js'
import { audioCommands, audioHandler } from './slash/audio.js'
import { adventureCommands, adventureHandler } from './slash/adventure.js'

export class CommandRegistry {
  private slashCommands: Map<string, SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder> = new Map()
  private slashHandlers: Map<string, CommandHandler> = new Map()

  constructor() {
    this.registerAllCommands()
  }

  private registerAllCommands(): void {
    // Register slash commands
    this.registerSlashCommands(diceCommands, diceHandler)
    this.registerSlashCommands(voiceCommands, voiceHandler)
    this.registerSlashCommands(settingsCommands, settingsHandler)
    this.registerSlashCommands(characterCommands, characterHandler)
    this.registerSlashCommands(icCommands, icHandler)
    this.registerSlashCommands(timestampCommands, timestampHandler)
    this.registerSlashCommands(aiGenerateCommands, aiGenerateHandler)
    this.registerSlashCommands(eventCommands, eventHandler)
    this.registerSlashCommands(audioCommands, audioHandler)
    this.registerSlashCommands(adventureCommands, adventureHandler)
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
