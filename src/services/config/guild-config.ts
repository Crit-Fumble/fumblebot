/**
 * Guild Configuration Service
 *
 * Unified interface for guild configuration that:
 * - Fetches general settings from Core Admin API
 * - Manages AI-specific settings in local FumbleBot database
 */

import { getCoreClient } from '../../lib/core-client.js'
import { getPrisma } from '../db/client.js'
import type { GuildAIConfig } from '.prisma/fumblebot'

// ===========================================
// Types
// ===========================================

/**
 * General guild configuration (stored in Core)
 */
export interface GuildGeneralConfig {
  prefix: string
  language: string
  timezone: string
  allowDMs: boolean
  diceRolling: boolean
  voiceCommands: boolean
  aiAssistant: boolean
  knowledgeBase: boolean
  scheduling: boolean
}

/**
 * AI-specific configuration (stored in FumbleBot)
 */
export interface GuildAISettings {
  primaryModel: string
  lookupModel: string
  thinkingModel: string
  temperature: number
  maxTokens: number
  enableThinking: boolean
  enableLookup: boolean
  enableContext: boolean
  enableMemory: boolean
  maxContextMessages: number
  contextWindowHours: number
  customSettings: Record<string, unknown>
}

/**
 * Complete guild configuration
 */
export interface GuildConfig {
  general: GuildGeneralConfig
  ai: GuildAISettings
}

// ===========================================
// Default Configurations
// ===========================================

const DEFAULT_GENERAL_CONFIG: GuildGeneralConfig = {
  prefix: '!',
  language: 'en',
  timezone: 'UTC',
  allowDMs: true,
  diceRolling: true,
  voiceCommands: false,
  aiAssistant: true,
  knowledgeBase: true,
  scheduling: true,
}

const DEFAULT_AI_CONFIG: GuildAISettings = {
  primaryModel: 'claude-sonnet-4-20250514',
  lookupModel: 'claude-haiku-4-20250514',
  thinkingModel: 'claude-sonnet-4-20250514',
  temperature: 0.7,
  maxTokens: 2000,
  enableThinking: true,
  enableLookup: true,
  enableContext: true,
  enableMemory: true,
  maxContextMessages: 20,
  contextWindowHours: 24,
  customSettings: {},
}

// ===========================================
// Service Functions
// ===========================================

/**
 * Get complete guild configuration
 */
export async function getGuildConfig(guildId: string): Promise<GuildConfig> {
  const [general, ai] = await Promise.all([
    getGuildGeneralConfig(guildId),
    getGuildAIConfig(guildId),
  ])

  return { general, ai }
}

/**
 * Get general guild configuration from Core
 */
export async function getGuildGeneralConfig(guildId: string): Promise<GuildGeneralConfig> {
  try {
    const core = getCoreClient()
    const { config } = await core.calendar.getGuildConfig(guildId)

    return {
      prefix: config.prefix ?? DEFAULT_GENERAL_CONFIG.prefix,
      language: config.language ?? DEFAULT_GENERAL_CONFIG.language,
      timezone: config.timezone ?? DEFAULT_GENERAL_CONFIG.timezone,
      allowDMs: config.allowDMs ?? DEFAULT_GENERAL_CONFIG.allowDMs,
      diceRolling: config.diceRolling ?? DEFAULT_GENERAL_CONFIG.diceRolling,
      voiceCommands: config.voiceCommands ?? DEFAULT_GENERAL_CONFIG.voiceCommands,
      aiAssistant: config.aiAssistant ?? DEFAULT_GENERAL_CONFIG.aiAssistant,
      knowledgeBase: config.knowledgeBase ?? DEFAULT_GENERAL_CONFIG.knowledgeBase,
      scheduling: config.scheduling ?? DEFAULT_GENERAL_CONFIG.scheduling,
    }
  } catch (error) {
    console.warn(`[GuildConfig] Failed to fetch general config from Core for ${guildId}, using defaults:`, error)
    return DEFAULT_GENERAL_CONFIG
  }
}

/**
 * Get AI-specific guild configuration from FumbleBot database
 */
export async function getGuildAIConfig(guildId: string): Promise<GuildAISettings> {
  try {
    const prisma = getPrisma()
    const aiConfig = await prisma.guildAIConfig.findUnique({
      where: { guildId },
    })

    if (!aiConfig) {
      return DEFAULT_AI_CONFIG
    }

    return {
      primaryModel: aiConfig.primaryModel,
      lookupModel: aiConfig.lookupModel,
      thinkingModel: aiConfig.thinkingModel,
      temperature: aiConfig.temperature,
      maxTokens: aiConfig.maxTokens,
      enableThinking: aiConfig.enableThinking,
      enableLookup: aiConfig.enableLookup,
      enableContext: aiConfig.enableContext,
      enableMemory: aiConfig.enableMemory,
      maxContextMessages: aiConfig.maxContextMessages,
      contextWindowHours: aiConfig.contextWindowHours,
      customSettings: (aiConfig.customSettings as Record<string, unknown>) || {},
    }
  } catch (error) {
    console.warn(`[GuildConfig] Failed to fetch AI config for ${guildId}, using defaults:`, error)
    return DEFAULT_AI_CONFIG
  }
}

/**
 * Update general guild configuration in Core
 */
export async function updateGuildGeneralConfig(
  guildId: string,
  updates: Partial<GuildGeneralConfig>
): Promise<GuildGeneralConfig> {
  const core = getCoreClient()
  const { config } = await core.calendar.setGuildConfig(guildId, updates)

  return {
    prefix: config.prefix ?? DEFAULT_GENERAL_CONFIG.prefix,
    language: config.language ?? DEFAULT_GENERAL_CONFIG.language,
    timezone: config.timezone ?? DEFAULT_GENERAL_CONFIG.timezone,
    allowDMs: config.allowDMs ?? DEFAULT_GENERAL_CONFIG.allowDMs,
    diceRolling: config.diceRolling ?? DEFAULT_GENERAL_CONFIG.diceRolling,
    voiceCommands: config.voiceCommands ?? DEFAULT_GENERAL_CONFIG.voiceCommands,
    aiAssistant: config.aiAssistant ?? DEFAULT_GENERAL_CONFIG.aiAssistant,
    knowledgeBase: config.knowledgeBase ?? DEFAULT_GENERAL_CONFIG.knowledgeBase,
    scheduling: config.scheduling ?? DEFAULT_GENERAL_CONFIG.scheduling,
  }
}

/**
 * Update AI-specific guild configuration in FumbleBot database
 */
export async function updateGuildAIConfig(
  guildId: string,
  updates: Partial<GuildAISettings>
): Promise<GuildAISettings> {
  const prisma = getPrisma()

  // Prepare update data
  const updateData: Partial<GuildAIConfig> = {}
  if (updates.primaryModel !== undefined) updateData.primaryModel = updates.primaryModel
  if (updates.lookupModel !== undefined) updateData.lookupModel = updates.lookupModel
  if (updates.thinkingModel !== undefined) updateData.thinkingModel = updates.thinkingModel
  if (updates.temperature !== undefined) updateData.temperature = updates.temperature
  if (updates.maxTokens !== undefined) updateData.maxTokens = updates.maxTokens
  if (updates.enableThinking !== undefined) updateData.enableThinking = updates.enableThinking
  if (updates.enableLookup !== undefined) updateData.enableLookup = updates.enableLookup
  if (updates.enableContext !== undefined) updateData.enableContext = updates.enableContext
  if (updates.enableMemory !== undefined) updateData.enableMemory = updates.enableMemory
  if (updates.maxContextMessages !== undefined) updateData.maxContextMessages = updates.maxContextMessages
  if (updates.contextWindowHours !== undefined) updateData.contextWindowHours = updates.contextWindowHours
  if (updates.customSettings !== undefined) updateData.customSettings = updates.customSettings

  const aiConfig = await prisma.guildAIConfig.upsert({
    where: { guildId },
    create: {
      guildId,
      ...updateData,
    },
    update: updateData,
  })

  return {
    primaryModel: aiConfig.primaryModel,
    lookupModel: aiConfig.lookupModel,
    thinkingModel: aiConfig.thinkingModel,
    temperature: aiConfig.temperature,
    maxTokens: aiConfig.maxTokens,
    enableThinking: aiConfig.enableThinking,
    enableLookup: aiConfig.enableLookup,
    enableContext: aiConfig.enableContext,
    enableMemory: aiConfig.enableMemory,
    maxContextMessages: aiConfig.maxContextMessages,
    contextWindowHours: aiConfig.contextWindowHours,
    customSettings: (aiConfig.customSettings as Record<string, unknown>) || {},
  }
}

/**
 * Get command prefix for a guild
 * Convenience helper for quick access
 */
export async function getGuildPrefix(guildId: string): Promise<string> {
  const config = await getGuildGeneralConfig(guildId)
  return config.prefix
}

/**
 * Get AI model settings for a guild
 * Convenience helper for AI services
 */
export async function getGuildAIModels(guildId: string): Promise<{
  primaryModel: string
  lookupModel: string
  thinkingModel: string
  temperature: number
  maxTokens: number
}> {
  const config = await getGuildAIConfig(guildId)
  return {
    primaryModel: config.primaryModel,
    lookupModel: config.lookupModel,
    thinkingModel: config.thinkingModel,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  }
}
