/**
 * Database module exports
 */

export { prisma, db, DatabaseService, Prisma } from './client.js'

// Re-export all Prisma types
export type {
  Guild,
  GuildMember,
  DiceRoll,
  Session,
  BotCommand,
  AuthUser,
  AuthSession,
  AuthAccount,
  ExpressSession,
  PromptPartial,
  PromptTargetType,
  CachedRule,
  ChannelKBSource,
  ChannelKBType,
  UserSettings,
  BotPersona,
  PersonaWebhook,
  BotSkill,
  BotMemory,
} from './client.js'
