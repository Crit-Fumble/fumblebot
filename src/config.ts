/**
 * FumbleBot Configuration
 * Loads and validates configuration from environment variables
 *
 * All environment variables should be accessed through this module
 * to ensure consistent naming, validation, and defaults.
 */

import type {
  BotConfig,
  DiscordConfig,
  OpenAIConfig,
  AnthropicConfig,
  APIConfig,
  DatabaseConfig,
  GradientConfig,
  CoreProxyConfig,
  VoiceConfig,
  SecurityConfig,
  ServerConfig,
} from './models/types.js'

// =============================================================================
// Environment Variable Helpers
// =============================================================================

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

function getEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key]
  if (!value) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

// =============================================================================
// Bot Configuration Loaders (existing)
// =============================================================================

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
  const inferenceKey = getEnvOptional('FUMBLEBOT_GRADIENT_INFERENCE_KEY')
  if (!inferenceKey) {
    return undefined // Gradient is optional
  }

  return {
    inferenceKey,
    accessToken: getEnvOptional('FUMBLEBOT_GRADIENT_ACCESS_TOKEN'),
    baseUrl: getEnvOptional('FUMBLEBOT_GRADIENT_BASE_URL', 'https://inference.do-ai.run/v1'),
    enableLLMAuditor: getEnvOptional('FUMBLEBOT_GRADIENT_LLM_AUDITOR', 'false') === 'true',
    enableGuardrails: getEnvOptional('FUMBLEBOT_GRADIENT_GUARDRAILS', 'false') === 'true',
    defaultModel: getEnvOptional('FUMBLEBOT_GRADIENT_MODEL', 'llama-3.3-70b-instruct'),
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

// =============================================================================
// Platform Configuration Loaders (new)
// =============================================================================

/**
 * Load Core server proxy configuration
 * Returns undefined if CORE_SERVER_URL is not set (local development)
 */
export function loadCoreProxyConfig(): CoreProxyConfig | undefined {
  const url = getEnvOptional('CORE_SERVER_URL')
  if (!url) {
    return undefined // Core proxy is optional in development
  }

  const secret = getEnvOptional('CORE_SECRET')
  if (!secret) {
    console.warn('[Config] CORE_SERVER_URL is set but CORE_SECRET is missing')
  }

  return {
    url,
    port: getEnvInt('CORE_SERVER_PORT', 4000),
    secret: secret || '',
  }
}

/**
 * Load voice/audio service configuration
 * All voice features are optional
 */
export function loadVoiceConfig(): VoiceConfig {
  return {
    deepgramApiKey: getEnvOptional('FUMBLEBOT_DEEPGRAM_API_KEY') || undefined,
    testGuildId: getEnvOptional('FUMBLEBOT_DISCORD_TEST_GUILD_ID') || undefined,
  }
}

/**
 * Load security/session configuration
 * Handles multiple fallback patterns for auth secrets
 */
export function loadSecurityConfig(): SecurityConfig {
  // Auth secret with fallbacks for compatibility
  const authSecret =
    getEnvOptional('AUTH_SECRET') ||
    getEnvOptional('FUMBLEBOT_DISCORD_CLIENT_SECRET') ||
    getEnvOptional('NEXTAUTH_SECRET') ||
    ''

  // Session secret (required for Express sessions)
  const sessionSecret =
    getEnvOptional('SESSION_SECRET') ||
    authSecret ||
    ''

  // Admin IDs (comma-separated)
  const adminIdsRaw = getEnvOptional('FUMBLEBOT_ADMIN_IDS')
  const adminIds = adminIdsRaw
    ? adminIdsRaw.split(',').map(id => id.trim()).filter(Boolean)
    : []

  return {
    sessionSecret,
    authSecret,
    adminIds,
  }
}

/**
 * Load server configuration
 */
export function loadServerConfig(): ServerConfig {
  const nodeEnv = (getEnvOptional('NODE_ENV', 'development') as ServerConfig['nodeEnv'])
  return {
    port: getEnvInt('FUMBLEBOT_ACTIVITY_PORT', 3000),
    host: getEnvOptional('FUMBLEBOT_ACTIVITY_HOST', '0.0.0.0'),
    publicUrl: getEnvOptional('FUMBLEBOT_ACTIVITY_PUBLIC_URL', 'http://localhost:3000'),
    nodeEnv,
    isProduction: nodeEnv === 'production',
  }
}

// =============================================================================
// Convenience Getters (cached singletons)
// =============================================================================

let _coreProxyConfig: CoreProxyConfig | undefined | null = null
let _voiceConfig: VoiceConfig | null = null
let _securityConfig: SecurityConfig | null = null
let _serverConfig: ServerConfig | null = null

/**
 * Get Core proxy config (cached)
 */
export function getCoreProxyConfig(): CoreProxyConfig | undefined {
  if (_coreProxyConfig === null) {
    _coreProxyConfig = loadCoreProxyConfig()
  }
  return _coreProxyConfig
}

/**
 * Get voice config (cached)
 */
export function getVoiceConfig(): VoiceConfig {
  if (_voiceConfig === null) {
    _voiceConfig = loadVoiceConfig()
  }
  return _voiceConfig
}

/**
 * Get security config (cached)
 */
export function getSecurityConfig(): SecurityConfig {
  if (_securityConfig === null) {
    _securityConfig = loadSecurityConfig()
  }
  return _securityConfig
}

/**
 * Get server config (cached)
 */
export function getServerConfig(): ServerConfig {
  if (_serverConfig === null) {
    _serverConfig = loadServerConfig()
  }
  return _serverConfig
}

/**
 * Check if a user is an admin
 */
export function isAdmin(userId: string): boolean {
  return getSecurityConfig().adminIds.includes(userId)
}

// =============================================================================
// Validation
// =============================================================================

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

/**
 * Validate platform configuration
 * Call at server startup to catch missing config early
 */
export function validatePlatformConfig(): string[] {
  const errors: string[] = []
  const security = getSecurityConfig()
  const server = getServerConfig()

  // Session secret is required for production
  if (server.isProduction && !security.sessionSecret) {
    errors.push('SESSION_SECRET is required in production')
  }

  // Warn about missing optional config
  const coreProxy = getCoreProxyConfig()
  if (server.isProduction && !coreProxy) {
    errors.push('CORE_SERVER_URL is required in production for activity proxy')
  }

  if (coreProxy && !coreProxy.secret) {
    errors.push('CORE_SECRET is required when CORE_SERVER_URL is set')
  }

  return errors
}
