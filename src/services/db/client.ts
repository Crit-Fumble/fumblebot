/**
 * FumbleBot Database Client
 * Prisma client wrapper with guild-aware security model
 */

// Import from the generated client location
// @ts-ignore - Prisma generates this at build time
import { PrismaClient } from '../../node_modules/.prisma/fumblebot/index.js'

// Global for hot reloading in development
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

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
  // Scripted Content Operations
  // ===========================================

  async getBehavior(creatureType: string) {
    return prisma.scriptedBehavior.findUnique({
      where: { creatureType: creatureType.toLowerCase() },
    })
  }

  async saveBehavior(creatureType: string, conditions: unknown) {
    return prisma.scriptedBehavior.upsert({
      where: { creatureType: creatureType.toLowerCase() },
      update: { conditions: conditions as any, generatedAt: new Date() },
      create: {
        creatureType: creatureType.toLowerCase(),
        conditions: conditions as any,
      },
    })
  }

  async getDialogue(npcId: string) {
    return prisma.dialogueTree.findUnique({
      where: { npcId },
    })
  }

  async saveDialogue(npcId: string, npcName: string, nodes: unknown, startNodeId: string) {
    return prisma.dialogueTree.upsert({
      where: { npcId },
      update: { npcName, nodes: nodes as any, startNodeId, generatedAt: new Date() },
      create: { npcId, npcName, nodes: nodes as any, startNodeId },
    })
  }

  async getTable(tableId: string) {
    return prisma.randomTable.findUnique({
      where: { tableId },
    })
  }

  async saveTable(tableId: string, name: string, entries: unknown) {
    return prisma.randomTable.upsert({
      where: { tableId },
      update: { name, entries: entries as any, generatedAt: new Date() },
      create: { tableId, name, entries: entries as any },
    })
  }

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

export const db = DatabaseService.getInstance()
