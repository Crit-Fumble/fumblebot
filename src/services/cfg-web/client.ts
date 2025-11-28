/**
 * API Client
 * Client for communicating with the crit-fumble.com backend
 * Supports bot authentication via X-Discord-Bot-Id header
 */

import type {
  APIConfig,
  UserStatusResponse,
  CritUser,
  WikiPage,
  WikiPageCreate,
  WikiPageUpdate,
  WikiListResponse,
  BotStatusResponse,
} from '../../models/types.js'

export interface APIClientConfig extends APIConfig {
  botDiscordId?: string
  botApiSecret?: string
}

export class APIClient {
  private static instance: APIClient | null = null

  private baseUrl: string
  private botDiscordId: string | null
  private botApiSecret: string | null

  private constructor(config: APIClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.botDiscordId = config.botDiscordId || null
    this.botApiSecret = config.botApiSecret || null
  }

  /**
   * Get singleton instance
   */
  static getInstance(): APIClient {
    if (!APIClient.instance) {
      // Initialize with default config
      APIClient.instance = new APIClient({
        baseUrl: 'https://www.crit-fumble.com',
      })
    }
    return APIClient.instance
  }

  /**
   * Initialize the client with config
   */
  static initialize(config: APIClientConfig): APIClient {
    APIClient.instance = new APIClient(config)
    return APIClient.instance
  }

  /**
   * Set the bot's Discord ID for authentication
   */
  setBotDiscordId(discordId: string): void {
    this.botDiscordId = discordId
  }

  /**
   * Make an API request
   * Includes bot authentication if botDiscordId is set
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Bot-Source': 'fumblebot',
      ...(options.headers as Record<string, string>),
    }

    // Add bot authentication headers if configured
    if (this.botDiscordId) {
      headers['X-Discord-Bot-Id'] = this.botDiscordId
    }
    if (this.botApiSecret) {
      headers['X-Bot-Secret'] = this.botApiSecret
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error (${response.status}): ${errorText}`)
    }

    return response.json() as Promise<T>
  }

  // ===========================================
  // Bot Status
  // ===========================================

  /**
   * Check bot authentication status with the API
   */
  async getBotStatus(): Promise<BotStatusResponse> {
    try {
      return await this.request<BotStatusResponse>('/api/bot/status', {
        method: 'GET',
      })
    } catch (error) {
      return {
        status: 'error',
        authenticated: false,
        timestamp: new Date().toISOString(),
      }
    }
  }

  // ===========================================
  // Wiki Operations
  // ===========================================

  /**
   * List all wiki pages
   */
  async listWikiPages(): Promise<WikiPage[]> {
    const response = await this.request<WikiListResponse>('/api/wiki', {
      method: 'GET',
    })
    return response.pages
  }

  /**
   * Get a single wiki page by ID
   */
  async getWikiPage(id: string): Promise<WikiPage> {
    return this.request<WikiPage>(`/api/wiki/${id}`, {
      method: 'GET',
    })
  }

  /**
   * Get a wiki page by slug
   */
  async getWikiPageBySlug(slug: string): Promise<WikiPage | null> {
    try {
      const pages = await this.listWikiPages()
      return pages.find(p => p.slug === slug) || null
    } catch {
      return null
    }
  }

  /**
   * Create a new wiki page
   */
  async createWikiPage(data: WikiPageCreate): Promise<WikiPage> {
    return this.request<WikiPage>('/api/wiki', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  /**
   * Update an existing wiki page
   */
  async updateWikiPage(id: string, data: WikiPageUpdate): Promise<WikiPage> {
    return this.request<WikiPage>(`/api/wiki/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  /**
   * Delete a wiki page (soft delete)
   */
  async deleteWikiPage(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/wiki/${id}`, {
      method: 'DELETE',
    })
  }

  /**
   * Create or update a wiki page by slug
   * Useful for bot operations that may need to create or update
   */
  async upsertWikiPage(
    slug: string,
    data: Omit<WikiPageCreate, 'slug'> & Partial<WikiPageUpdate>
  ): Promise<WikiPage> {
    const existing = await this.getWikiPageBySlug(slug)

    if (existing) {
      return this.updateWikiPage(existing.id, {
        title: data.title,
        content: data.content,
        category: data.category,
        isPublished: data.isPublished,
        changeNote: data.changeNote,
      })
    }

    return this.createWikiPage({
      slug,
      title: data.title,
      category: data.category,
      content: data.content,
    })
  }

  // ===========================================
  // User Operations
  // ===========================================

  /**
   * Get user status by Discord ID
   */
  async getUserStatus(discordId: string): Promise<UserStatusResponse> {
    return this.request<UserStatusResponse>('/api/discord/activity/user-status', {
      method: 'POST',
      body: JSON.stringify({ discordId }),
    })
  }

  /**
   * Auto-register a new user from Discord
   */
  async autoRegister(data: {
    discordId: string
    discordUsername: string
    discordAvatar: string | null
    displayName: string
    email?: string | null
  }): Promise<{ success: boolean; alreadyExists: boolean; user: CritUser }> {
    return this.request('/api/discord/activity/auto-register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // ===========================================
  // Session Operations
  // ===========================================

  /**
   * Get user session data
   */
  async getSession(sessionId: string): Promise<any> {
    return this.request(`/api/sessions/${sessionId}`, {
      method: 'GET',
    })
  }

  /**
   * Create a new gaming session
   */
  async createSession(data: {
    name: string
    system?: string
    guildId?: string
    channelId?: string
    creatorDiscordId: string
  }): Promise<{ sessionId: string; code: string }> {
    return this.request('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  /**
   * Join a session
   */
  async joinSession(code: string, discordId: string): Promise<{ success: boolean }> {
    return this.request(`/api/sessions/join`, {
      method: 'POST',
      body: JSON.stringify({ code, discordId }),
    })
  }

  // ===========================================
  // Stats Operations
  // ===========================================

  /**
   * Get user's dice statistics
   */
  async getDiceStats(discordId: string): Promise<{
    totalRolls: number
    criticalHits: number
    fumbles: number
    averageRoll: number
  }> {
    return this.request(`/api/users/${discordId}/stats/dice`, {
      method: 'GET',
    })
  }

  /**
   * Record a dice roll
   */
  async recordDiceRoll(data: {
    discordId: string
    guildId?: string
    channelId?: string
    notation: string
    rolls: number[]
    total: number
    isCrit: boolean
    isFumble: boolean
  }): Promise<void> {
    return this.request('/api/stats/dice-roll', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  /**
   * Get Discord server stats
   */
  async getDiscordStats(): Promise<{
    memberCount: number
    onlineCount: number
    channelCount: number
  } | null> {
    try {
      return await this.request('/api/discord/stats', { method: 'GET' })
    } catch {
      return null
    }
  }

  // ===========================================
  // Health Check
  // ===========================================

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; timestamp: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`)
      if (response.ok) {
        return { status: 'ok', timestamp: new Date().toISOString() }
      }
      return { status: 'error', timestamp: new Date().toISOString() }
    } catch {
      return { status: 'error', timestamp: new Date().toISOString() }
    }
  }
}
