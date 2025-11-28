/**
 * FumbleBot Types
 * Core type definitions for the bot
 */

// Bot configuration
export interface BotConfig {
  discord: DiscordConfig
  openai: OpenAIConfig
  anthropic: AnthropicConfig
  gradient?: GradientConfig // Optional: DigitalOcean Gradient AI Platform
  api: APIConfig
  database: DatabaseConfig
}

export interface DatabaseConfig {
  url: string
}

export interface GradientConfig {
  apiKey: string
  apiUrl?: string
  enableLLMAuditor?: boolean // Fact-checking layer
  enableGuardrails?: boolean // Content moderation
  defaultModel?: string // e.g., 'llama-3.3-70b', 'llama-3.1-8b'
}

export interface DiscordConfig {
  token: string
  clientId: string
  clientSecret: string
  publicKey: string
  guildId?: string // Optional: specific server to register commands
}

export interface OpenAIConfig {
  apiKey: string
  model: string
  maxTokens: number
}

export interface AnthropicConfig {
  apiKey: string
  model: string
  maxTokens: number
}

export interface APIConfig {
  baseUrl: string
}

// Discord types
export interface DiscordUser {
  id: string
  username: string
  discriminator: string
  avatar: string | null
  globalName: string | null
  bot?: boolean
}

export interface DiscordGuild {
  id: string
  name: string
  icon: string | null
  ownerId: string
  memberCount: number
}

// AI types
export type AIProvider = 'openai' | 'anthropic'

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AICompletionOptions {
  provider?: AIProvider
  model?: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

export interface AICompletionResult {
  content: string
  provider: AIProvider
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

// Command types
export interface CommandContext {
  userId: string
  username: string
  guildId?: string
  channelId: string
}

export interface CommandResult {
  content: string
  ephemeral?: boolean
  embeds?: CommandEmbed[]
}

export interface CommandEmbed {
  title?: string
  description?: string
  color?: number
  fields?: { name: string; value: string; inline?: boolean }[]
  footer?: { text: string }
  timestamp?: string
}

// API types
export interface CritUser {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  roles: string[]
  isOwner: boolean
  tier: string
}

export interface UserStatusResponse {
  isLinked: boolean
  user: CritUser | null
  error?: string
}

// Wiki types
export interface WikiPage {
  id: string
  slug: string
  title: string
  category: string
  content: string
  isPublished: boolean
  publishedAt?: string
  createdAt: string
  updatedAt: string
  author?: { name: string }
  lastEditor?: { name: string }
}

export interface WikiPageCreate {
  slug: string
  title: string
  category: string
  content?: string
}

export interface WikiPageUpdate {
  title?: string
  content?: string
  category?: string
  isPublished?: boolean
  changeNote?: string
}

export interface WikiListResponse {
  pages: WikiPage[]
}

export interface BotStatusResponse {
  status: 'ok' | 'error'
  authenticated: boolean
  discordId?: string
  role?: 'owner' | 'admin' | 'user'
  timestamp: string
}
