/**
 * FumbleBot Discord Slash Commands & Context Menu Commands
 *
 * This file defines all slash commands and app menu commands for FumbleBot.
 * Commands are organized by category for easy management.
 */

import {
  SlashCommandBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
} from 'discord.js';

// ===========================================
// Slash Commands
// ===========================================

/**
 * /fumble - Main bot command group
 */
export const fumbleCommand = new SlashCommandBuilder()
  .setName('fumble')
  .setDescription('FumbleBot commands')
  // Campaign subcommands
  .addSubcommandGroup((group) =>
    group
      .setName('campaign')
      .setDescription('Campaign management')
      .addSubcommand((sub) =>
        sub
          .setName('list')
          .setDescription('List all campaigns in this server')
      )
      .addSubcommand((sub) =>
        sub
          .setName('info')
          .setDescription('Show campaign details')
          .addStringOption((opt) =>
            opt
              .setName('name')
              .setDescription('Campaign name')
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName('create')
          .setDescription('Create a new campaign (Admin only)')
          .addStringOption((opt) =>
            opt.setName('name').setDescription('Campaign name').setRequired(true)
          )
          .addStringOption((opt) =>
            opt
              .setName('system')
              .setDescription('Game system')
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addStringOption((opt) =>
            opt.setName('description').setDescription('Campaign description')
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName('delete')
          .setDescription('Delete a campaign (Admin only)')
          .addStringOption((opt) =>
            opt
              .setName('name')
              .setDescription('Campaign name')
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
  )
  // Character subcommands
  .addSubcommandGroup((group) =>
    group
      .setName('character')
      .setDescription('Character management')
      .addSubcommand((sub) =>
        sub
          .setName('list')
          .setDescription('List your characters')
          .addStringOption((opt) =>
            opt
              .setName('campaign')
              .setDescription('Campaign name')
              .setAutocomplete(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName('info')
          .setDescription('Show character details')
          .addStringOption((opt) =>
            opt
              .setName('name')
              .setDescription('Character name')
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName('select')
          .setDescription('Set your active character')
          .addStringOption((opt) =>
            opt
              .setName('name')
              .setDescription('Character name')
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName('create')
          .setDescription('Create a new character')
          .addStringOption((opt) =>
            opt.setName('name').setDescription('Character name').setRequired(true)
          )
          .addStringOption((opt) =>
            opt
              .setName('campaign')
              .setDescription('Campaign name')
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addStringOption((opt) =>
            opt
              .setName('type')
              .setDescription('Character type')
              .setRequired(true)
              .addChoices(
                { name: 'Player Character', value: 'pc' },
                { name: 'NPC', value: 'npc' },
                { name: 'Familiar', value: 'familiar' },
                { name: 'Companion', value: 'companion' }
              )
          )
      )
  )
  // Session subcommands
  .addSubcommandGroup((group) =>
    group
      .setName('session')
      .setDescription('Game session management')
      .addSubcommand((sub) =>
        sub
          .setName('start')
          .setDescription('Start a new game session (GM only)')
          .addStringOption((opt) =>
            opt
              .setName('campaign')
              .setDescription('Campaign name')
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addStringOption((opt) =>
            opt.setName('name').setDescription('Session name (e.g., "Session 12")')
          )
      )
      .addSubcommand((sub) =>
        sub.setName('end').setDescription('End the current session (GM only)')
      )
      .addSubcommand((sub) =>
        sub.setName('pause').setDescription('Pause the current session (GM only)')
      )
      .addSubcommand((sub) =>
        sub.setName('resume').setDescription('Resume a paused session (GM only)')
      )
      .addSubcommand((sub) =>
        sub.setName('status').setDescription('Show current session status')
      )
  );

/**
 * /say - Speak as your character (in-character)
 */
export const sayCommand = new SlashCommandBuilder()
  .setName('say')
  .setDescription('Speak as your character (in-character)')
  .addStringOption((opt) =>
    opt.setName('message').setDescription('What your character says').setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName('character')
      .setDescription('Speak as a different character')
      .setAutocomplete(true)
  );

/**
 * /ooc - Out-of-character message
 */
export const oocCommand = new SlashCommandBuilder()
  .setName('ooc')
  .setDescription('Send an out-of-character message')
  .addStringOption((opt) =>
    opt.setName('message').setDescription('Your OOC message').setRequired(true)
  );

/**
 * /narrate - GM narration (GM only)
 */
export const narrateCommand = new SlashCommandBuilder()
  .setName('narrate')
  .setDescription('Add GM narration to the session (GM only)')
  .addStringOption((opt) =>
    opt.setName('text').setDescription('Narration text').setRequired(true)
  );

/**
 * /roll - Dice rolling
 */
export const rollCommand = new SlashCommandBuilder()
  .setName('roll')
  .setDescription('Roll dice')
  .addStringOption((opt) =>
    opt
      .setName('dice')
      .setDescription('Dice notation (e.g., 2d20+5, 4d6kh3)')
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName('label').setDescription('What the roll is for')
  )
  .addBooleanOption((opt) =>
    opt.setName('hidden').setDescription('Only show result to you and GM')
  );

/**
 * /settings - Bot settings
 */
export const settingsCommand = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('Configure FumbleBot settings')
  .addSubcommand((sub) =>
    sub.setName('view').setDescription('View current settings')
  )
  .addSubcommand((sub) =>
    sub
      .setName('default-character')
      .setDescription('Set your default character for this server')
      .addStringOption((opt) =>
        opt
          .setName('character')
          .setDescription('Character name')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('message-mode')
      .setDescription('Set your default message mode')
      .addStringOption((opt) =>
        opt
          .setName('mode')
          .setDescription('Default mode')
          .setRequired(true)
          .addChoices(
            { name: 'In-Character', value: 'ic' },
            { name: 'Out-of-Character', value: 'ooc' }
          )
      )
  );

/**
 * /link - Link Discord roles to Foundry roles (Admin only)
 */
export const linkCommand = new SlashCommandBuilder()
  .setName('link')
  .setDescription('Link Discord roles to Foundry permissions (Admin only)')
  .addSubcommand((sub) =>
    sub
      .setName('role')
      .setDescription('Link a Discord role to a Foundry role')
      .addStringOption((opt) =>
        opt
          .setName('campaign')
          .setDescription('Campaign name')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addRoleOption((opt) =>
        opt.setName('discord-role').setDescription('Discord role').setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('foundry-role')
          .setDescription('Foundry role level')
          .setRequired(true)
          .addChoices(
            { name: 'Player', value: '1' },
            { name: 'Trusted Player', value: '2' },
            { name: 'Assistant GM', value: '3' },
            { name: 'Game Master', value: '4' }
          )
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('character')
      .setDescription('Link a character to a Discord user')
      .addStringOption((opt) =>
        opt
          .setName('character')
          .setDescription('Character name')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addUserOption((opt) =>
        opt.setName('user').setDescription('Discord user').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('Show all role mappings for a campaign')
      .addStringOption((opt) =>
        opt
          .setName('campaign')
          .setDescription('Campaign name')
          .setRequired(true)
          .setAutocomplete(true)
      )
  );

// ===========================================
// Context Menu Commands (Right-click menus)
// ===========================================

/**
 * User Context Menu: "View Character"
 * Right-click on a user to see their character
 */
export const viewCharacterUserMenu = new ContextMenuCommandBuilder()
  .setName('View Character')
  .setType(ApplicationCommandType.User);

/**
 * User Context Menu: "Assign Character"
 * Right-click on a user to assign them a character (GM only)
 */
export const assignCharacterUserMenu = new ContextMenuCommandBuilder()
  .setName('Assign Character')
  .setType(ApplicationCommandType.User);

/**
 * Message Context Menu: "Log as IC"
 * Right-click on a message to log it as in-character
 */
export const logAsICMenu = new ContextMenuCommandBuilder()
  .setName('Log as IC')
  .setType(ApplicationCommandType.Message);

/**
 * Message Context Menu: "Log as OOC"
 * Right-click on a message to log it as out-of-character
 */
export const logAsOOCMenu = new ContextMenuCommandBuilder()
  .setName('Log as OOC')
  .setType(ApplicationCommandType.Message);

/**
 * Message Context Menu: "Log as Narration"
 * Right-click on a message to log it as narration (GM only)
 */
export const logAsNarrationMenu = new ContextMenuCommandBuilder()
  .setName('Log as Narration')
  .setType(ApplicationCommandType.Message);

// ===========================================
// Export all commands
// ===========================================

export const slashCommands = [
  fumbleCommand,
  sayCommand,
  oocCommand,
  narrateCommand,
  rollCommand,
  settingsCommand,
  linkCommand,
];

export const contextMenuCommands = [
  viewCharacterUserMenu,
  assignCharacterUserMenu,
  logAsICMenu,
  logAsOOCMenu,
  logAsNarrationMenu,
];

export const allCommands = [...slashCommands, ...contextMenuCommands];

/**
 * Get commands as JSON for registration
 */
export function getCommandsJSON() {
  return allCommands.map((cmd) => cmd.toJSON());
}
