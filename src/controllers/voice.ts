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
    const sessionInfo = voiceAssistant.getSessionInfo(guildId)

    res.json({
      guildId,
      connected: isConnected,
      channelId: channelId || null,
      listening: isListening,
      mode: sessionInfo?.mode || null,
      startedBy: sessionInfo?.startedBy || null,
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
      sessions: sessions.map((session) => {
        const sessionInfo = voiceAssistant.getSessionInfo(session.guildId)
        return {
          guildId: session.guildId,
          channelId: session.channelId,
          listening: voiceAssistant.isActive(session.guildId),
          mode: sessionInfo?.mode || null,
          startedBy: sessionInfo?.startedBy || null,
        }
      }),
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
 * Body: { guildId: string, channelId: string, mode?: 'transcribe' | 'assistant', startedBy?: string }
 */
export async function handleVoiceListenStart(req: Request, res: Response): Promise<void> {
  try {
    const { guildId, channelId, mode, startedBy } = req.body

    if (!guildId || !channelId) {
      res.status(400).json({ error: 'guildId and channelId are required' })
      return
    }

    // Validate mode if provided
    if (mode && mode !== 'transcribe' && mode !== 'assistant') {
      res.status(400).json({ error: 'mode must be either "transcribe" or "assistant"' })
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

    // Start listening with mode and startedBy options
    await voiceAssistant.startListening(channel, undefined, {
      mode: mode || 'assistant',
      startedBy: startedBy || 'api',
    })

    res.json({
      success: true,
      guildId,
      channelId,
      listening: true,
      mode: mode || 'assistant',
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

/**
 * GET /api/voice/transcript/:guildId
 * Get the current transcript for a voice session
 */
export async function handleVoiceTranscript(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params

    if (!guildId) {
      res.status(400).json({ error: 'guildId parameter is required' })
      return
    }

    const transcript = voiceAssistant.getTranscript(guildId)

    if (!transcript) {
      res.status(404).json({ error: 'No transcript found for this guild' })
      return
    }

    res.json({
      guildId,
      transcript,
    })
  } catch (error) {
    console.error('[Voice API] Error getting transcript:', error)
    res.status(500).json({
      error: 'Failed to get transcript',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * POST /api/voice/mode
 * Change the voice mode between transcribe and assistant
 *
 * Body: { guildId: string, mode: 'transcribe' | 'assistant' }
 */
export async function handleVoiceMode(req: Request, res: Response): Promise<void> {
  try {
    const { guildId, mode } = req.body

    if (!guildId) {
      res.status(400).json({ error: 'guildId is required' })
      return
    }

    if (!mode || (mode !== 'transcribe' && mode !== 'assistant')) {
      res.status(400).json({ error: 'mode must be either "transcribe" or "assistant"' })
      return
    }

    if (!voiceAssistant.isActive(guildId)) {
      res.status(400).json({ error: 'No active voice session in this guild' })
      return
    }

    const sessionInfo = voiceAssistant.getSessionInfo(guildId)

    // If already in requested mode, return success
    if (sessionInfo?.mode === mode) {
      res.json({
        success: true,
        guildId,
        mode,
        message: `Already in ${mode} mode`,
      })
      return
    }

    // Enable assistant mode (transcribe -> assistant)
    if (mode === 'assistant') {
      const enabled = voiceAssistant.enableAssistantMode(guildId)
      if (!enabled) {
        res.status(400).json({ error: 'Failed to enable assistant mode' })
        return
      }
    } else {
      // To downgrade from assistant to transcribe, we'd need to add a method to voiceAssistant
      // For now, return an error asking to restart the session
      res.status(400).json({
        error: 'Cannot downgrade from assistant to transcribe mode. Stop and restart the session instead.',
      })
      return
    }

    res.json({
      success: true,
      guildId,
      mode,
      message: `Switched to ${mode} mode`,
    })
  } catch (error) {
    console.error('[Voice API] Error changing mode:', error)
    res.status(500).json({
      error: 'Failed to change voice mode',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
