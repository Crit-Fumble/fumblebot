/**
 * Command Registry
 * Manages all slash commands, context menus, and their handlers
 */

import {
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  type RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from 'discord.js'
import type { CommandHandler, ContextMenuHandler } from './types.js'

// Import command modules
import { diceCommands, diceHandler } from './slash/dice.js'
import { aiCommands, aiHandler } from './slash/ai.js'
// import { serverCommands, serverHandler } from './slash/server.js'
import { userCommands, userHandler } from './slash/user.js'
import { activityCommands, activityHandler } from './slash/activity.js'
import { foundryCommands, foundryHandler } from './slash/foundry.js'
// import { rpgCommands, rpgHandler } from './slash/rpg.js'
import { userContextMenus, userContextHandler } from './context/user.js'
import { messageContextMenus, messageContextHandler } from './context/message.js'

export class CommandRegistry {
  private slashCommands: Map<string, SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder> = new Map()
  private contextMenus: Map<string, ContextMenuCommandBuilder> = new Map()
  private slashHandlers: Map<string, CommandHandler> = new Map()
  private contextHandlers: Map<string, ContextMenuHandler> = new Map()

  constructor() {
    this.registerAllCommands()
  }

  private registerAllCommands(): void {
    // Register slash commands
    this.registerSlashCommands(diceCommands, diceHandler)
    this.registerSlashCommands(aiCommands, aiHandler)
    // this.registerSlashCommands(serverCommands, serverHandler)
    this.registerSlashCommands(userCommands, userHandler)
    this.registerSlashCommands(activityCommands, activityHandler)
    this.registerSlashCommands(foundryCommands, foundryHandler)
    // this.registerSlashCommands(rpgCommands, rpgHandler)

    // Register context menus (right-click commands)
    this.registerContextMenus(userContextMenus, userContextHandler)
    this.registerContextMenus(messageContextMenus, messageContextHandler)
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

  private registerContextMenus(
    menus: ContextMenuCommandBuilder[],
    handler: ContextMenuHandler
  ): void {
    for (const menu of menus) {
      this.contextMenus.set(menu.name, menu)
      this.contextHandlers.set(menu.name, handler)
    }
  }

  /**
   * Get a slash command handler by name
   */
  getSlashHandler(name: string): CommandHandler | undefined {
    return this.slashHandlers.get(name)
  }

  /**
   * Get a context menu handler by name
   */
  getContextHandler(name: string): ContextMenuHandler | undefined {
    return this.contextHandlers.get(name)
  }

  /**
   * Get all commands as JSON for Discord API registration
   */
  getCommandsJSON(): (
    | RESTPostAPIChatInputApplicationCommandsJSONBody
    | RESTPostAPIContextMenuApplicationCommandsJSONBody
  )[] {
    const slashJSON = Array.from(this.slashCommands.values()).map((cmd) =>
      cmd.toJSON()
    )
    const contextJSON = Array.from(this.contextMenus.values()).map((menu) =>
      menu.toJSON()
    )
    return [...slashJSON, ...contextJSON]
  }

  /**
   * Get command count
   */
  get commandCount(): number {
    return this.slashCommands.size + this.contextMenus.size
  }
}
