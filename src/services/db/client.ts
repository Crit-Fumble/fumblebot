/**
 * FumbleBot Database Client
 *
 * Unified Prisma client with:
 * - SSL/TLS with CA certificate support for DigitalOcean VPC
 * - Guild-aware security model
 * - Hot reloading in development
 */

import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import { readFileSync, existsSync } from 'fs'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Navigate up to project root (from src/services/db or dist/services/db)
const projectRoot = resolve(__dirname, '..', '..', '..')
const requireFromRoot = createRequire(join(projectRoot, 'package.json'))

// Dynamically require the Prisma client from node_modules/.prisma/fumblebot
const prismaModule = requireFromRoot('.prisma/fumblebot')
const PrismaClient = prismaModule.PrismaClient as new (options?: { adapter: PrismaPg }) => any

// Re-export Prisma namespace for type access
export const Prisma = prismaModule.Prisma

// ===========================================
// SSL/TLS Configuration
// ===========================================

/**
 * Load CA certificate from file path or environment variable.
 * Returns the certificate content or undefined if not available.
 */
function loadCaCertificate(): string | undefined {
  // Check for CA cert path in environment
  const certPath = process.env.DATABASE_CA_CERT

  if (!certPath) {
    return undefined
  }

  // Resolve relative paths from project root
  const resolvedPath = resolve(projectRoot, certPath)

  if (!existsSync(resolvedPath)) {
    console.warn(`[DB] CA certificate not found at: ${resolvedPath}`)
    return undefined
  }

  try {
    const cert = readFileSync(resolvedPath, 'utf-8')
    console.log(`[DB] Loaded CA certificate from: ${resolvedPath}`)
    return cert
  } catch (error) {
    console.error(`[DB] Failed to read CA certificate:`, error)
    return undefined
  }
}

/**
 * Build SSL configuration for pg Pool.
 * - If CA cert is available: use it with rejectUnauthorized: true
 * - If no CA cert but SSL required: use rejectUnauthorized: false (managed DB fallback)
 * - If local/no SSL: undefined
 */
function buildSslConfig(): pg.PoolConfig['ssl'] {
  const caCert = loadCaCertificate()
  const connectionUrl = process.env.FUMBLEBOT_DATABASE_URL || ''
  const requiresSsl = connectionUrl.includes('sslmode=require') ||
                      connectionUrl.includes('digitalocean.com')

  if (caCert) {
    // Best case: proper SSL with CA certificate verification
    console.log('[DB] SSL enabled with CA certificate verification')
    return {
      ca: caCert,
      rejectUnauthorized: true,
    }
  }

  if (requiresSsl) {
    // Fallback: SSL without certificate verification (DigitalOcean managed DB)
    // This is less secure but necessary when CA cert isn't configured
    console.warn('[DB] SSL enabled WITHOUT certificate verification (set DATABASE_CA_CERT for secure connection)')
    return {
      rejectUnauthorized: false,
    }
  }

  // Local development without SSL
  return undefined
}

// ===========================================
// Connection Setup
// ===========================================

// Parse connection string and remove sslmode (conflicts with pg's ssl option)
const rawConnectionUrl = process.env.FUMBLEBOT_DATABASE_URL || 'postgresql://localhost/fumblebot'
let connectionString = rawConnectionUrl

try {
  const connectionUrl = new URL(rawConnectionUrl)
  connectionUrl.searchParams.delete('sslmode')
  connectionString = connectionUrl.toString()
} catch {
  // If URL parsing fails, use as-is (might be a simple connection string)
  console.warn('[DB] Could not parse connection URL, using as-is')
}

// Build SSL config
const sslConfig = buildSslConfig()

// Create a pg Pool with proper SSL configuration
const pool = new pg.Pool({
  connectionString,
  ssl: sslConfig,
})

// Create the PostgreSQL adapter using the pool
const adapter = new PrismaPg({ pool })

// Type the global for hot reloading in development
const globalForPrisma = globalThis as unknown as { prisma: InstanceType<typeof PrismaClient> | undefined }

// Export singleton Prisma client
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// ===========================================
// DatabaseService - Guild-aware operations
// ===========================================

/**
 * Database service with guild security model
 */
export class DatabaseService {
  private static instance: DatabaseService | null = null
  private homeGuildId: string | null = null

  private constructor() {}

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService()
    }
    return DatabaseService.instance
  }

  /**
   * Initialize with home guild ID from config
   */
  initialize(homeGuildId?: string): void {
    this.homeGuildId = homeGuildId || null
    console.log(`[DB] Initialized${this.homeGuildId ? ` with home guild: ${this.homeGuildId}` : ''}`)
  }

  /**
   * Check if a guild is the home guild (admin access)
   */
  isHomeGuild(guildId: string): boolean {
    return this.homeGuildId !== null && guildId === this.homeGuildId
  }

  /**
   * Require home guild for admin operations
   * @throws Error if not home guild
   */
  requireHomeGuild(guildId: string): void {
    if (!this.isHomeGuild(guildId)) {
      throw new Error('Admin functionality restricted to home guild')
    }
  }

  /**
   * Ensure a guild exists in the database
   * Creates if not exists, marks as home if matches FUMBLEBOT_DISCORD_GUILD_ID
   */
  async ensureGuild(guildId: string, name?: string): Promise<void> {
    const isHome = this.isHomeGuild(guildId)

    await prisma.guild.upsert({
      where: { guildId },
      update: { name, isHome },
      create: {
        guildId,
        name,
        isHome,
        settings: {},
      },
    })
  }

  /**
   * Get guild with admin check
   */
  async getGuild(guildId: string) {
    return prisma.guild.findUnique({
      where: { guildId },
    })
  }

  /**
   * Ensure a guild member exists
   */
  async ensureGuildMember(
    guildId: string,
    discordId: string,
    username: string,
    roles: string[] = [],
    isAdmin = false
  ): Promise<void> {
    await prisma.guildMember.upsert({
      where: { guildId_discordId: { guildId, discordId } },
      update: { username, roles, isAdmin },
      create: { guildId, discordId, username, roles, isAdmin },
    })
  }

  // ===========================================
  // Rule Cache (local ephemeral cache)
  // ===========================================

  async getCachedRule(system: string, query: string) {
    const rule = await prisma.cachedRule.findUnique({
      where: { system_query: { system, query: query.toLowerCase() } },
    })

    // Check if expired
    if (rule && rule.expiresAt < new Date()) {
      return null
    }

    return rule
  }

  async saveRule(system: string, query: string, answer: string, ttlHours = 24) {
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)

    return prisma.cachedRule.upsert({
      where: { system_query: { system, query: query.toLowerCase() } },
      update: { answer, cachedAt: new Date(), expiresAt },
      create: { system, query: query.toLowerCase(), answer, expiresAt },
    })
  }

  async clearExpiredRules(): Promise<number> {
    const result = await prisma.cachedRule.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
    return result.count
  }

  // ===========================================
  // Gaming & Statistics
  // ===========================================

  async recordDiceRoll(data: {
    guildId: string
    discordId: string
    channelId?: string
    notation: string
    rolls: number[]
    total: number
    isCrit?: boolean
    isFumble?: boolean
  }) {
    return prisma.diceRoll.create({
      data: {
        guildId: data.guildId,
        discordId: data.discordId,
        channelId: data.channelId,
        notation: data.notation,
        rolls: data.rolls,
        total: data.total,
        isCrit: data.isCrit ?? false,
        isFumble: data.isFumble ?? false,
      },
    })
  }

  async getDiceStats(discordId: string) {
    const rolls = await prisma.diceRoll.findMany({
      where: { discordId },
    })

    const totalRolls = rolls.length
    const criticalHits = rolls.filter((r) => r.isCrit).length
    const fumbles = rolls.filter((r) => r.isFumble).length
    const averageRoll = totalRolls > 0 ? rolls.reduce((sum, r) => sum + r.total, 0) / totalRolls : 0

    return { totalRolls, criticalHits, fumbles, averageRoll }
  }

  async createSession(data: { guildId: string; channelId?: string; name: string; system?: string; code: string }) {
    return prisma.session.create({ data })
  }

  async getSession(code: string) {
    return prisma.session.findUnique({
      where: { code },
    })
  }

  async endSession(code: string) {
    return prisma.session.update({
      where: { code },
      data: { isActive: false },
    })
  }

  // ===========================================
  // Analytics
  // ===========================================

  async logCommand(guildId: string, discordId: string, command: string, subcommand?: string) {
    return prisma.botCommand.create({
      data: { guildId, discordId, command, subcommand },
    })
  }

  async getCommandStats(guildId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    return prisma.botCommand.groupBy({
      by: ['command'],
      where: { guildId, executedAt: { gte: since } },
      _count: { command: true },
      orderBy: { _count: { command: 'desc' } },
    })
  }
}

// Export singleton DatabaseService instance
export const db = DatabaseService.getInstance()

// ===========================================
// Compatibility exports for old db.ts users
// ===========================================

/**
 * Get the singleton Prisma client instance.
 * @deprecated Use `prisma` directly instead
 */
export function getPrisma() {
  return prisma
}

// Re-export all generated types
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
} from '.prisma/fumblebot'
