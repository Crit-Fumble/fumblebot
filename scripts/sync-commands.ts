#!/usr/bin/env npx tsx
/**
 * Discord Command Sync Script
 *
 * Syncs slash commands with Discord, with options to:
 * - List all registered commands (guild + global)
 * - Clear all commands
 * - Sync only changed commands
 * - Force re-register all commands
 *
 * Usage:
 *   npx tsx scripts/sync-commands.ts [options]
 *
 * Options:
 *   --list         List all registered commands
 *   --clear        Clear all commands (guild + global)
 *   --clear-guild  Clear only guild commands
 *   --clear-global Clear only global commands
 *   --sync         Sync commands (default, registers defined commands)
 *   --force        Force re-register all commands even if unchanged
 *   --global       Register as global commands (default is guild-only for dev)
 */

import { REST, Routes } from 'discord.js'
import { config } from 'dotenv'
import { CommandRegistry } from '../src/services/discord/commands/registry.js'

// Load environment variables
config()

const TOKEN = process.env.FUMBLEBOT_DISCORD_TOKEN
const CLIENT_ID = process.env.FUMBLEBOT_DISCORD_CLIENT_ID
const GUILD_ID = process.env.FUMBLEBOT_DISCORD_GUILD_ID

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing required environment variables:')
  if (!TOKEN) console.error('  - FUMBLEBOT_DISCORD_TOKEN')
  if (!CLIENT_ID) console.error('  - FUMBLEBOT_DISCORD_CLIENT_ID')
  process.exit(1)
}

const rest = new REST({ version: '10' }).setToken(TOKEN)

interface Command {
  id: string
  name: string
  description: string
  options?: unknown[]
}

async function listCommands(): Promise<void> {
  console.log('\n=== Registered Discord Commands ===\n')

  // Global commands
  console.log('Global Commands:')
  try {
    const globalCommands = (await rest.get(Routes.applicationCommands(CLIENT_ID))) as Command[]
    if (globalCommands.length === 0) {
      console.log('  (none)')
    } else {
      for (const cmd of globalCommands) {
        console.log(`  - /${cmd.name}: ${cmd.description} [ID: ${cmd.id}]`)
      }
    }
  } catch (error) {
    console.error('  Error fetching global commands:', error)
  }

  // Guild commands
  if (GUILD_ID) {
    console.log(`\nGuild Commands (${GUILD_ID}):`)
    try {
      const guildCommands = (await rest.get(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      )) as Command[]
      if (guildCommands.length === 0) {
        console.log('  (none)')
      } else {
        for (const cmd of guildCommands) {
          console.log(`  - /${cmd.name}: ${cmd.description} [ID: ${cmd.id}]`)
        }
      }
    } catch (error) {
      console.error('  Error fetching guild commands:', error)
    }
  } else {
    console.log('\nGuild Commands: (no FUMBLEBOT_DISCORD_GUILD_ID set)')
  }

  console.log('')
}

async function clearCommands(scope: 'all' | 'guild' | 'global'): Promise<void> {
  console.log(`\n=== Clearing ${scope} commands ===\n`)

  if (scope === 'all' || scope === 'global') {
    console.log('Clearing global commands...')
    try {
      // First, get all commands to delete them individually (avoids Entry Point issue)
      const commands = (await rest.get(Routes.applicationCommands(CLIENT_ID))) as Command[]
      let deleted = 0
      let skipped = 0

      for (const cmd of commands) {
        // Skip Entry Point commands (type 4) - these must be deleted from Developer Portal
        if (cmd.name === 'launch' || (cmd as any).type === 4) {
          console.log(`  Skipping Entry Point command: /${cmd.name}`)
          skipped++
          continue
        }

        try {
          await rest.delete(Routes.applicationCommand(CLIENT_ID, cmd.id))
          console.log(`  Deleted: /${cmd.name}`)
          deleted++
        } catch (err) {
          console.error(`  Failed to delete /${cmd.name}:`, (err as Error).message)
        }
      }

      console.log(`  Global commands cleared: ${deleted} deleted, ${skipped} skipped`)
    } catch (error) {
      console.error('  Error clearing global commands:', error)
    }
  }

  if ((scope === 'all' || scope === 'guild') && GUILD_ID) {
    console.log(`Clearing guild commands (${GUILD_ID})...`)
    try {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] })
      console.log('  Guild commands cleared.')
    } catch (error: any) {
      if (error.code === 50001) {
        console.log('  Skipping guild commands (bot not in guild or missing access)')
      } else {
        console.error('  Error clearing guild commands:', error.message)
      }
    }
  } else if (scope === 'guild' && !GUILD_ID) {
    console.log('  No FUMBLEBOT_DISCORD_GUILD_ID set, skipping guild commands.')
  }

  console.log('')
}

async function syncCommands(global: boolean, force: boolean): Promise<void> {
  const registry = new CommandRegistry()
  const commands = registry.getCommandsJSON()

  console.log(`\n=== Syncing ${commands.length} command(s) ===\n`)

  if (commands.length === 0) {
    console.log('No commands defined in registry.')
    return
  }

  // Show commands to be registered
  console.log('Commands to register:')
  for (const cmd of commands) {
    console.log(`  - /${cmd.name}: ${cmd.description}`)
  }
  console.log('')

  if (global) {
    console.log('Registering global commands...')
    try {
      // Fetch existing commands to preserve Entry Point commands
      const existingCommands = (await rest.get(Routes.applicationCommands(CLIENT_ID))) as any[]
      const entryPointCommands = existingCommands.filter(
        (cmd) => cmd.type === 4 || cmd.handler === 1 // Entry point commands
      )

      // Merge entry point commands with new commands
      const allCommands = [...commands]
      for (const ep of entryPointCommands) {
        // Only add if not already in commands list
        if (!allCommands.find((c) => c.name === ep.name)) {
          console.log(`  Preserving Entry Point command: /${ep.name}`)
          allCommands.push({
            name: ep.name,
            description: ep.description || 'Launch an activity',
            type: ep.type,
            handler: ep.handler,
          } as any)
        }
      }

      const result = await rest.put(Routes.applicationCommands(CLIENT_ID), { body: allCommands })
      console.log(`  Successfully registered ${(result as Command[]).length} global command(s).`)
    } catch (error) {
      console.error('  Error registering global commands:', error)
    }
  } else if (GUILD_ID) {
    console.log(`Registering guild commands (${GUILD_ID})...`)
    try {
      const result = await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
        body: commands,
      })
      console.log(`  Successfully registered ${(result as Command[]).length} guild command(s).`)
    } catch (error: any) {
      if (error.code === 50001) {
        console.log('  Cannot register guild commands (bot not in guild or missing access)')
        console.log('  Try using --global flag to register global commands instead')
      } else {
        console.error('  Error registering guild commands:', error.message)
      }
    }
  } else {
    console.error('No FUMBLEBOT_DISCORD_GUILD_ID set. Use --global to register global commands.')
    process.exit(1)
  }

  console.log('')
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Parse arguments
  const doList = args.includes('--list')
  const doClear = args.includes('--clear')
  const doClearGuild = args.includes('--clear-guild')
  const doClearGlobal = args.includes('--clear-global')
  const doSync = args.includes('--sync') || args.length === 0 // Default action
  const forceSync = args.includes('--force')
  const globalSync = args.includes('--global')

  console.log('Discord Command Sync')
  console.log('====================')
  console.log(`Client ID: ${CLIENT_ID}`)
  console.log(`Guild ID: ${GUILD_ID || '(not set)'}`)

  if (doList) {
    await listCommands()
  }

  if (doClear) {
    await clearCommands('all')
  } else if (doClearGuild) {
    await clearCommands('guild')
  } else if (doClearGlobal) {
    await clearCommands('global')
  }

  if (doSync && !doClear && !doClearGuild && !doClearGlobal) {
    await syncCommands(globalSync, forceSync)
  } else if ((doClear || doClearGuild || doClearGlobal) && args.includes('--sync')) {
    // If explicitly asked to sync after clear
    await syncCommands(globalSync, forceSync)
  }

  // List after changes if we made any
  if ((doClear || doClearGuild || doClearGlobal || doSync) && !doList) {
    await listCommands()
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
