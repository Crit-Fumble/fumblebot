/**
 * API Client
 * Client for communicating with the crit-fumble.com backend
 */

import type { APIConfig, UserStatusResponse, CritUser } from '../types.js'

export class APIClient {
  private static instance: APIClient | null = null

  private baseUrl: string

  private constructor(config: APIConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '') // Remove trailing slash
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
  static initialize(config: APIConfig): APIClient {
    APIClient.instance = new APIClient(config)
    return APIClient.instance
  }

  /**
   * Make an API request
   * Auth is handled via Discord ID in the request body where needed
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Bot-Source': 'fumblebot', // Identify requests from FumbleBot
      ...(options.headers as Record<string, string>),
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