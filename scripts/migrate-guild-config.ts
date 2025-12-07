/**
 * Guild Configuration Migration Script
 *
 * Migrates guild settings from local JSON storage to:
 * - Core Admin API (general settings: prefix, timezone, etc.)
 * - FumbleBot GuildAIConfig table (AI settings: models, temperature, etc.)
 *
 * Usage:
 *   tsx scripts/migrate-guild-config.ts [--dry-run] [--guild GUILD_ID]
 */

import { getCoreClient } from '../src/lib/core-client.js'
import { getPrisma } from '../src/services/db/client.js'

// ===========================================
// Types
// ===========================================

interface LegacyGuildSettings {
  // General settings (migrate to Core)
  prefix?: string
  language?: string
  timezone?: string
  allowDMs?: boolean
  diceRolling?: boolean
  voiceCommands?: boolean
  aiAssistant?: boolean
  knowledgeBase?: boolean
  scheduling?: boolean

  // AI settings (migrate to GuildAIConfig)
  aiModel?: string
  primaryModel?: string
  lookupModel?: string
  thinkingModel?: string
  aiTemperature?: number
  temperature?: number
  maxTokens?: number
  enableThinking?: boolean
  enableLookup?: boolean
  enableContext?: boolean
  enableMemory?: boolean
  maxContextMessages?: number
  contextWindowHours?: number

  // Other/custom settings
  [key: string]: unknown
}

// ===========================================
// Migration Logic
// ===========================================

async function migrateGuild(guildId: string, settings: LegacyGuildSettings, dryRun: boolean) {
  console.log(`\n[${guildId}] Migrating guild settings...`)

  // Extract general settings for Core
  const generalSettings = {
    prefix: settings.prefix,
    language: settings.language,
    timezone: settings.timezone,
    allowDMs: settings.allowDMs,
    diceRolling: settings.diceRolling,
    voiceCommands: settings.voiceCommands,
    aiAssistant: settings.aiAssistant,
    knowledgeBase: settings.knowledgeBase,
    scheduling: settings.scheduling,
  }

  // Extract AI settings for FumbleBot
  const aiSettings = {
    primaryModel: settings.primaryModel || settings.aiModel || 'claude-sonnet-4-20250514',
    lookupModel: settings.lookupModel || 'claude-haiku-4-20250514',
    thinkingModel: settings.thinkingModel || settings.primaryModel || 'claude-sonnet-4-20250514',
    temperature: settings.temperature ?? settings.aiTemperature ?? 0.7,
    maxTokens: settings.maxTokens ?? 2000,
    enableThinking: settings.enableThinking ?? true,
    enableLookup: settings.enableLookup ?? true,
    enableContext: settings.enableContext ?? true,
    enableMemory: settings.enableMemory ?? true,
    maxContextMessages: settings.maxContextMessages ?? 20,
    contextWindowHours: settings.contextWindowHours ?? 24,
  }

  // Extract custom settings (anything not in the predefined fields)
  const knownKeys = new Set([
    'prefix',
    'language',
    'timezone',
    'allowDMs',
    'diceRolling',
    'voiceCommands',
    'aiAssistant',
    'knowledgeBase',
    'scheduling',
    'aiModel',
    'primaryModel',
    'lookupModel',
    'thinkingModel',
    'aiTemperature',
    'temperature',
    'maxTokens',
    'enableThinking',
    'enableLookup',
    'enableContext',
    'enableMemory',
    'maxContextMessages',
    'contextWindowHours',
  ])

  const customSettings: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(settings)) {
    if (!knownKeys.has(key)) {
      customSettings[key] = value
    }
  }

  if (dryRun) {
    console.log(`  [DRY RUN] Would migrate to Core:`, generalSettings)
    console.log(`  [DRY RUN] Would migrate to GuildAIConfig:`, aiSettings)
    if (Object.keys(customSettings).length > 0) {
      console.log(`  [DRY RUN] Custom settings:`, customSettings)
    }
    return
  }

  // Migrate general settings to Core
  try {
    const core = getCoreClient()
    // Remove undefined values
    const coreUpdates = Object.fromEntries(
      Object.entries(generalSettings).filter(([, value]) => value !== undefined)
    )

    if (Object.keys(coreUpdates).length > 0) {
      await core.calendar.setGuildConfig(guildId, coreUpdates)
      console.log(`  ✅ Migrated general settings to Core`)
    } else {
      console.log(`  ℹ️  No general settings to migrate to Core`)
    }
  } catch (error) {
    console.error(`  ❌ Failed to migrate general settings to Core:`, error)
  }

  // Migrate AI settings to GuildAIConfig
  try {
    const prisma = getPrisma()
    await prisma.guildAIConfig.upsert({
      where: { guildId },
      create: {
        guildId,
        ...aiSettings,
        customSettings: customSettings,
      },
      update: {
        ...aiSettings,
        customSettings: customSettings,
      },
    })
    console.log(`  ✅ Migrated AI settings to GuildAIConfig`)
  } catch (error) {
    console.error(`  ❌ Failed to migrate AI settings to GuildAIConfig:`, error)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const guildIdIndex = args.indexOf('--guild')
  const specificGuildId = guildIdIndex !== -1 ? args[guildIdIndex + 1] : null

  console.log('🔄 Guild Configuration Migration')
  console.log('================================')
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE MIGRATION'}`)
  console.log(`Target: ${specificGuildId || 'all guilds'}`)
  console.log('')

  const prisma = getPrisma()

  // Fetch guilds to migrate
  const guilds = await prisma.guild.findMany({
    where: specificGuildId ? { guildId: specificGuildId } : {},
    select: {
      guildId: true,
      name: true,
      settings: true,
    },
  })

  console.log(`Found ${guilds.length} guild(s) to migrate`)

  let successCount = 0
  let skipCount = 0

  for (const guild of guilds) {
    const settings = guild.settings as LegacyGuildSettings

    // Skip if settings is empty or just {}
    if (!settings || Object.keys(settings).length === 0) {
      console.log(`\n[${guild.guildId}] ${guild.name || 'Unknown'}: No settings to migrate (skipped)`)
      skipCount++
      continue
    }

    try {
      await migrateGuild(guild.guildId, settings, dryRun)
      successCount++
    } catch (error) {
      console.error(`\n[${guild.guildId}] Migration failed:`, error)
    }
  }

  console.log('\n================================')
  console.log('Migration Summary')
  console.log(`  Total guilds: ${guilds.length}`)
  console.log(`  Migrated: ${successCount}`)
  console.log(`  Skipped: ${skipCount}`)
  console.log(`  Failed: ${guilds.length - successCount - skipCount}`)

  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN - no changes were made')
    console.log('Run without --dry-run to perform the actual migration')
  } else {
    console.log('\n✅ Migration complete!')
    console.log('\nNext steps:')
    console.log('  1. Verify settings in Core Admin API')
    console.log('  2. Update code to use new config system')
    console.log('  3. Remove deprecated Guild.settings field (future migration)')
  }

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
