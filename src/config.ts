/**
 * FumbleBot Configuration
 * Loads and validates configuration from environment variables
 */

import type { BotConfig, DiscordConfig, OpenAIConfig, AnthropicConfig, APIConfig, DatabaseConfig, GradientConfig } from './types.js'

function getEnv(key: string, required = true): string {
  const value = process.env[key]
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value || ''
}

function getEnvOptional(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue
}

export function loadDiscordConfig(): DiscordConfig {
  return {
    token: getEnv('FUMBLEBOT_DISCORD_TOKEN'),
    clientId: getEnv('FUMBLEBOT_DISCORD_CLIENT_ID'),
    clientSecret: getEnv('FUMBLEBOT_DISCORD_CLIENT_SECRET'),
    publicKey: getEnv('FUMBLEBOT_DISCORD_PUBLIC_KEY'),
    guildId: getEnvOptional('FUMBLEBOT_DISCORD_GUILD_ID') || undefined,
  }
}

export function loadOpenAIConfig(): OpenAIConfig {
  return {
    apiKey: getEnv('FUMBLEBOT_OPENAI_API_KEY'),
    model: 'gpt-4o',
    maxTokens: 2048,
  }
}

export function loadAnthropicConfig(): AnthropicConfig {
  return {
    apiKey: getEnv('FUMBLEBOT_ANTHROPIC_API_KEY'),
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2048,
  }
}

export function loadAPIConfig(): APIConfig {
  return {
    baseUrl: 'https://www.crit-fumble.com',
    botApiSecret: getEnvOptional('FUMBLEBOT_API_SECRET') || undefined,
  }
}

export function loadDatabaseConfig(): DatabaseConfig {
  return {
    url: getEnv('FUMBLEBOT_DATABASE_URL'),
  }
}

export function loadGradientConfig(): GradientConfig | undefined {
  const apiKey = getEnvOptional('FUMBLEBOT_GRADIENT_API_KEY')
  if (!apiKey) {
    return undefined // Gradient is optional
  }

  return {
    apiKey,
    apiUrl: getEnvOptional('FUMBLEBOT_GRADIENT_API_URL', 'https://api.digitalocean.com/v2/gradient'),
    enableLLMAuditor: getEnvOptional('FUMBLEBOT_GRADIENT_LLM_AUDITOR', 'false') === 'true',
    enableGuardrails: getEnvOptional('FUMBLEBOT_GRADIENT_GUARDRAILS', 'false') === 'true',
    defaultModel: getEnvOptional('FUMBLEBOT_GRADIENT_MODEL', 'llama-3.1-8b'),
  }
}

export function loadConfig(): BotConfig {
  return {
    discord: loadDiscordConfig(),
    openai: loadOpenAIConfig(),
    anthropic: loadAnthropicConfig(),
    gradient: loadGradientConfig(),
    api: loadAPIConfig(),
    database: loadDatabaseConfig(),
  }
}

/**
 * Validate that all required config is present
 * Returns list of missing/invalid config items
 */
export function validateConfig(config: BotConfig): string[] {
  const errors: string[] = []

  // Discord validation
  if (!config.discord.token) errors.push('Discord token is required')
  if (!config.discord.clientId) errors.push('Discord client ID is required')
  if (!config.discord.publicKey) errors.push('Discord public key is required')

  // Both AI providers are required
  if (!config.openai.apiKey) errors.push('OpenAI API key is required')
  if (!config.anthropic.apiKey) errors.push('Anthropic API key is required')

  // Database is required
  if (!config.database.url) errors.push('Database URL is required')

  return errors
}
