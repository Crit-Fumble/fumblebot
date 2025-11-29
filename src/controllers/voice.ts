/**
 * Voice API Controller
 * HTTP endpoints for voice channel operations via FumbleBot Discord bot
 *
 * These endpoints allow external services (like @crit-fumble/core) to control
 * FumbleBot's voice features: join/leave channels, play sounds, manage listening.
 */

import type { Request, Response } from 'express'
import { voiceClient, voiceAssistant } from '../services/discord/voice/index.js'

/**
 * Validate API secret for voice endpoints
 * Uses the same secret as AI endpoints for simplicity
 */
export function validateVoiceSecret(req: Request, res: Response, next: () => void): void {
  const secret = req.headers['x-voice-secret'] || req.headers['x-api-secret']
  const expectedSecret = process.env.FUMBLEBOT_API_SECRET

  if (!expectedSecret) {
    res.status(500).json({ error: 'Voice API not configured (missing FUMBLEBOT_API_SECRET)' })
    return
  }

  if (secret !== expectedSecret) {
    res.status(401).json({ error: 'Invalid or missing API secret' })
    return
  }

  next()
}

/**
 * GET /api/voice/status
 * Get voice connection status for a guild
 */
export async function handleVoiceStatus(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.query

    if (!guildId || typeof guildId !== 'string') {
      res.status(400).json({ error: 'guildId query parameter is required' })
      return
    }

    const isConnected = voiceClient.isConnected(guildId)
    const channelId = voiceClient.getCurrentChannel(guildId)
    const isListening = voiceAssistant.isActive(guildId)

    res.json({
      guildId,
      connected: isConnected,
      channelId: channelId || null,
      listening: isListening,
    })
  } catch (error) {
    console.error('[Voice API] Error getting status:', error)
    res.status(500).json({
      error: 'Failed to get voice status',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * GET /api/voice/sessions
 * Get all active voice sessions across all guilds
 */
export async function handleVoiceSessions(req: Request, res: Response): Promise<void> {
  try {
    const sessions = voiceClient.getActiveSessions()

    res.json({
      sessions: sessions.map((session) => ({
        guildId: session.guildId,
        channelId: session.channelId,
        listening: voiceAssistant.isActive(session.guildId),
      })),
      count: sessions.length,
    })
  } catch (error) {
    console.error('[Voice API] Error getting sessions:', error)
    res.status(500).json({
      error: 'Failed to get voice sessions',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * POST /api/voice/join
 * Join a voice channel
 *
 * Body: { guildId: string, channelId: string }
 *
 * Note: This requires the Discord bot to have access to the guild and channel.
 * The channel must be fetched from Discord, so this is async.
 */
export async function handleVoiceJoin(req: Request, res: Response): Promise<void> {
  try {
    const { guildId, channelId } = req.body

    if (!guildId || !channelId) {
      res.status(400).json({ error: 'guildId and channelId are required' })
      return
    }

    // Get the Discord client from the global bot instance
    // This requires the bot to be running and have the FumbleBotClient available
    const { getFumbleBotClient } = await import('../services/discord/index.js')
    const bot = getFumbleBotClient()

    if (!bot) {
      res.status(503).json({ error: 'Discord bot is not running' })
      return
    }

    // Fetch the guild and channel
    const guild = await bot.client.guilds.fetch(guildId)
    const channel = await guild.channels.fetch(channelId)

    if (!channel || !channel.isVoiceBased()) {
      res.status(400).json({ error: 'Invalid voice channel' })
      return
    }

    // Join the channel
    await voiceClient.joinChannel(channel)

    res.json({
      success: true,
      guildId,
      channelId,
      channelName: channel.name,
    })
  } catch (error) {
    console.error('[Voice API] Error joining channel:', error)
    res.status(500).json({
      error: 'Failed to join voice channel',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * POST /api/voice/leave
 * Leave a voice channel
 *
 * Body: { guildId: string }
 */
export async function handleVoiceLeave(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.body

    if (!guildId) {
      res.status(400).json({ error: 'guildId is required' })
      return
    }

    if (!voiceClient.isConnected(guildId)) {
      res.status(400).json({ error: 'Not connected to a voice channel in this guild' })
      return
    }

    // Stop listening if active
    if (voiceAssistant.isActive(guildId)) {
      await voiceAssistant.stopListening(guildId)
    }

    // Leave the channel
    await voiceClient.leaveChannel(guildId)

    res.json({
      success: true,
      guildId,
    })
  } catch (error) {
    console.error('[Voice API] Error leaving channel:', error)
    res.status(500).json({
      error: 'Failed to leave voice channel',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * POST /api/voice/play
 * Play audio from a URL
 *
 * Body: { guildId: string, url: string, volume?: number }
 */
export async function handleVoicePlay(req: Request, res: Response): Promise<void> {
  try {
    const { guildId, url, volume } = req.body

    if (!guildId || !url) {
      res.status(400).json({ error: 'guildId and url are required' })
      return
    }

    if (!voiceClient.isConnected(guildId)) {
      res.status(400).json({ error: 'Not connected to a voice channel in this guild' })
      return
    }

    // Play the audio
    // Note: volume control would need to be implemented in the voice client
    await voiceClient.playUrl(guildId, url)

    res.json({
      success: true,
      guildId,
      url,
    })
  } catch (error) {
    console.error('[Voice API] Error playing audio:', error)
    res.status(500).json({
      error: 'Failed to play audio',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * POST /api/voice/stop
 * Stop current audio playback
 *
 * Body: { guildId: string }
 */
export async function handleVoiceStop(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.body

    if (!guildId) {
      res.status(400).json({ error: 'guildId is required' })
      return
    }

    if (!voiceClient.isConnected(guildId)) {
      res.status(400).json({ error: 'Not connected to a voice channel in this guild' })
      return
    }

    voiceClient.stop(guildId)

    res.json({
      success: true,
      guildId,
    })
  } catch (error) {
    console.error('[Voice API] Error stopping playback:', error)
    res.status(500).json({
      error: 'Failed to stop playback',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * POST /api/voice/listen/start
 * Start listening for wake word in a voice channel
 *
 * Body: { guildId: string, channelId: string }
 */
export async function handleVoiceListenStart(req: Request, res: Response): Promise<void> {
  try {
    const { guildId, channelId } = req.body

    if (!guildId || !channelId) {
      res.status(400).json({ error: 'guildId and channelId are required' })
      return
    }

    // Check if already listening
    if (voiceAssistant.isActive(guildId)) {
      res.status(400).json({ error: 'Already listening in this guild' })
      return
    }

    // Get the Discord client
    const { getFumbleBotClient } = await import('../services/discord/index.js')
    const bot = getFumbleBotClient()

    if (!bot) {
      res.status(503).json({ error: 'Discord bot is not running' })
      return
    }

    // Fetch the guild and channel
    const guild = await bot.client.guilds.fetch(guildId)
    const channel = await guild.channels.fetch(channelId)

    if (!channel || !channel.isVoiceBased()) {
      res.status(400).json({ error: 'Invalid voice channel' })
      return
    }

    // Start listening (this will also join the channel if not already connected)
    await voiceAssistant.startListening(channel)

    res.json({
      success: true,
      guildId,
      channelId,
      listening: true,
    })
  } catch (error) {
    console.error('[Voice API] Error starting listener:', error)
    res.status(500).json({
      error: 'Failed to start voice listener',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * POST /api/voice/listen/stop
 * Stop listening for wake word
 *
 * Body: { guildId: string }
 */
export async function handleVoiceListenStop(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.body

    if (!guildId) {
      res.status(400).json({ error: 'guildId is required' })
      return
    }

    if (!voiceAssistant.isActive(guildId)) {
      res.status(400).json({ error: 'Not listening in this guild' })
      return
    }

    await voiceAssistant.stopListening(guildId)

    res.json({
      success: true,
      guildId,
      listening: false,
    })
  } catch (error) {
    console.error('[Voice API] Error stopping listener:', error)
    res.status(500).json({
      error: 'Failed to stop voice listener',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
