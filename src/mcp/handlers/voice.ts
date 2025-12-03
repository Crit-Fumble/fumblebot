/**
 * Voice Control Tool Handlers
 * Handles voice channel operations, TTS voice changes, and NPC role-playing
 */

import type { MCPToolResult } from './types.js';
import type { VoiceAssistant } from '../../services/discord/voice/assistant.js';
import type { VoiceClient } from '../../services/discord/voice/client.js';
import type { DeepgramTTS } from '../../services/discord/voice/deepgram-tts.js';
import type { Client, VoiceBasedChannel, TextChannel } from 'discord.js';

/** Voice descriptions for user display */
const VOICE_DESCRIPTIONS: Record<string, string> = {
  orion: 'Orion - Male narrator, warm and authoritative (default)',
  luna: 'Luna - Female, warm and friendly',
  zeus: 'Zeus - Male, deep and commanding',
  athena: 'Athena - Female, confident and authoritative',
  perseus: 'Perseus - Male, heroic and energetic',
  angus: 'Angus - Male, Scottish accent',
  stella: 'Stella - Female, bright and cheerful',
};

/** Map short voice names to Deepgram voice IDs */
const VOICE_MAP: Record<string, string> = {
  orion: 'aura-orion-en',
  luna: 'aura-luna-en',
  zeus: 'aura-zeus-en',
  athena: 'aura-athena-en',
  perseus: 'aura-perseus-en',
  angus: 'aura-angus-en',
  stella: 'aura-stella-en',
};

/** NPC role state per guild */
interface NPCRole {
  name: string;
  voice: string;
  personality?: string;
}

export class VoiceHandler {
  private discordClient: Client | null = null;
  private voiceAssistant: VoiceAssistant | null = null;
  private voiceClient: VoiceClient | null = null;
  private deepgramTTS: DeepgramTTS | null = null;
  private activeRoles: Map<string, NPCRole> = new Map();

  /**
   * Set the Discord client for voice operations
   */
  setDiscordClient(client: Client): void {
    this.discordClient = client;
  }

  /**
   * Set the voice assistant instance
   */
  setVoiceAssistant(assistant: VoiceAssistant): void {
    this.voiceAssistant = assistant;
  }

  /**
   * Set the voice client instance
   */
  setVoiceClient(client: VoiceClient): void {
    this.voiceClient = client;
  }

  /**
   * Set the Deepgram TTS instance
   */
  setDeepgramTTS(tts: DeepgramTTS): void {
    this.deepgramTTS = tts;
  }

  /**
   * Get the current NPC role for a guild (if any)
   */
  getActiveRole(guildId: string): NPCRole | undefined {
    return this.activeRoles.get(guildId);
  }

  async handle(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    switch (name) {
      case 'fumble_join_voice_assistant':
        return await this.joinVoiceAssistant(args);
      case 'fumble_join_voice_transcribe':
        return await this.joinVoiceTranscribe(args);
      case 'fumble_stop_assistant':
        return await this.stopAssistant(args);
      case 'fumble_stop_transcribe':
        return await this.stopTranscribe(args);
      case 'fumble_get_voice_status':
        return await this.getVoiceStatus(args);
      case 'fumble_set_voice':
        return await this.setVoice(args);
      case 'fumble_assume_role':
        return await this.assumeRole(args);
      case 'fumble_clear_role':
        return await this.clearRole(args);
      case 'fumble_list_voices':
        return await this.listVoices();
      default:
        throw new Error(`Unknown voice tool: ${name}`);
    }
  }

  private async joinVoiceAssistant(args: Record<string, unknown>): Promise<MCPToolResult> {
    const { channelId, guildId } = args as { channelId: string; guildId: string };

    if (!this.discordClient || !this.voiceAssistant) {
      return {
        content: [{ type: 'text', text: 'Voice system not initialized. Discord client not available.' }],
        isError: true,
      };
    }

    try {
      const guild = await this.discordClient.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId) as VoiceBasedChannel;

      if (!channel || !channel.isVoiceBased()) {
        return {
          content: [{ type: 'text', text: `Channel ${channelId} is not a voice channel or doesn't exist.` }],
          isError: true,
        };
      }

      // Find a text channel in the guild for responses
      const textChannel = guild.channels.cache.find(
        c => c.isTextBased() && !c.isDMBased() && !c.isThread()
      ) as TextChannel | undefined;

      if (this.voiceAssistant.isActive(guildId)) {
        return {
          content: [{ type: 'text', text: `Already active in this guild. Use fumble_stop_assistant first.` }],
          isError: true,
        };
      }

      await this.voiceAssistant.startListening(channel, textChannel, {
        mode: 'assistant',
        startedBy: 'mcp',
      });

      return {
        content: [{
          type: 'text',
          text: `Joined voice channel "${channel.name}" in assistant mode. Say "Hey FumbleBot" followed by a command to interact.`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to join voice: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        isError: true,
      };
    }
  }

  private async joinVoiceTranscribe(args: Record<string, unknown>): Promise<MCPToolResult> {
    const { channelId, guildId } = args as { channelId: string; guildId: string };

    if (!this.discordClient || !this.voiceAssistant) {
      return {
        content: [{ type: 'text', text: 'Voice system not initialized. Discord client not available.' }],
        isError: true,
      };
    }

    try {
      const guild = await this.discordClient.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId) as VoiceBasedChannel;

      if (!channel || !channel.isVoiceBased()) {
        return {
          content: [{ type: 'text', text: `Channel ${channelId} is not a voice channel or doesn't exist.` }],
          isError: true,
        };
      }

      const textChannel = guild.channels.cache.find(
        c => c.isTextBased() && !c.isDMBased() && !c.isThread()
      ) as TextChannel | undefined;

      if (this.voiceAssistant.isActive(guildId)) {
        return {
          content: [{ type: 'text', text: `Already active in this guild. Use fumble_stop_transcribe first.` }],
          isError: true,
        };
      }

      await this.voiceAssistant.startListening(channel, textChannel, {
        mode: 'transcribe',
        startedBy: 'mcp',
      });

      return {
        content: [{
          type: 'text',
          text: `Joined voice channel "${channel.name}" in transcription mode. Recording all speech for session notes.`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to join voice: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        isError: true,
      };
    }
  }

  private async stopAssistant(args: Record<string, unknown>): Promise<MCPToolResult> {
    const { guildId } = args as { guildId: string };

    if (!this.voiceAssistant || !this.voiceClient) {
      return {
        content: [{ type: 'text', text: 'Voice system not initialized.' }],
        isError: true,
      };
    }

    if (!this.voiceAssistant.isActive(guildId)) {
      return {
        content: [{ type: 'text', text: 'No active voice session in this guild.' }],
        isError: true,
      };
    }

    const sessionInfo = this.voiceAssistant.getSessionInfo(guildId);
    if (sessionInfo?.mode !== 'assistant') {
      return {
        content: [{ type: 'text', text: 'Session is in transcribe mode, not assistant mode. Use fumble_stop_transcribe.' }],
        isError: true,
      };
    }

    // Clear any active role
    this.activeRoles.delete(guildId);

    await this.voiceAssistant.stopListening(guildId);
    await this.voiceClient.leaveChannel(guildId);

    return {
      content: [{ type: 'text', text: 'Voice assistant session ended.' }],
    };
  }

  private async stopTranscribe(args: Record<string, unknown>): Promise<MCPToolResult> {
    const { guildId, userId } = args as { guildId: string; userId: string };

    if (!this.voiceAssistant || !this.voiceClient) {
      return {
        content: [{ type: 'text', text: 'Voice system not initialized.' }],
        isError: true,
      };
    }

    if (!this.voiceAssistant.isActive(guildId)) {
      return {
        content: [{ type: 'text', text: 'No active voice session in this guild.' }],
        isError: true,
      };
    }

    const sessionInfo = this.voiceAssistant.getSessionInfo(guildId);
    if (sessionInfo?.mode !== 'transcribe') {
      return {
        content: [{ type: 'text', text: 'Session is in assistant mode, not transcribe mode. Use fumble_stop_assistant.' }],
        isError: true,
      };
    }

    // DM the transcript to the user
    const transcript = this.voiceAssistant.getTranscript(guildId);
    if (transcript && transcript.entries.length > 0) {
      await this.voiceAssistant.dmSessionTranscript(userId, guildId);
    }

    await this.voiceAssistant.stopListening(guildId);
    await this.voiceClient.leaveChannel(guildId);

    const entryCount = transcript?.entries.length || 0;
    return {
      content: [{
        type: 'text',
        text: `Transcription session ended. ${entryCount > 0 ? `Transcript with ${entryCount} entries sent to user via DM.` : 'No entries were recorded.'}`,
      }],
    };
  }

  private async getVoiceStatus(args: Record<string, unknown>): Promise<MCPToolResult> {
    const { guildId } = args as { guildId: string };

    if (!this.voiceAssistant) {
      return {
        content: [{ type: 'text', text: 'Voice system not initialized.' }],
        isError: true,
      };
    }

    const isActive = this.voiceAssistant.isActive(guildId);
    if (!isActive) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ active: false, mode: null, channelId: null, role: null }, null, 2),
        }],
      };
    }

    const sessionInfo = this.voiceAssistant.getSessionInfo(guildId);
    const activeRole = this.activeRoles.get(guildId);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          active: true,
          mode: sessionInfo?.mode || 'unknown',
          channelId: sessionInfo?.channelId || null,
          channelName: sessionInfo?.channelName || null,
          role: activeRole || null,
        }, null, 2),
      }],
    };
  }

  private async setVoice(args: Record<string, unknown>): Promise<MCPToolResult> {
    const { voice } = args as { voice: string; guildId?: string };

    if (!this.deepgramTTS) {
      return {
        content: [{ type: 'text', text: 'TTS system not initialized.' }],
        isError: true,
      };
    }

    const voiceId = VOICE_MAP[voice.toLowerCase()];
    if (!voiceId) {
      return {
        content: [{ type: 'text', text: `Unknown voice: ${voice}. Use fumble_list_voices to see available options.` }],
        isError: true,
      };
    }

    this.deepgramTTS.setVoice(voiceId as any);

    return {
      content: [{
        type: 'text',
        text: `Voice changed to ${VOICE_DESCRIPTIONS[voice.toLowerCase()] || voice}.`,
      }],
    };
  }

  private async assumeRole(args: Record<string, unknown>): Promise<MCPToolResult> {
    const { name, voice, personality, guildId } = args as {
      name: string;
      voice?: string;
      personality?: string;
      guildId: string;
    };

    // Set the role
    const role: NPCRole = {
      name,
      voice: voice || 'orion',
      personality,
    };
    this.activeRoles.set(guildId, role);

    // Change voice if specified
    if (voice && this.deepgramTTS) {
      const voiceId = VOICE_MAP[voice.toLowerCase()];
      if (voiceId) {
        this.deepgramTTS.setVoice(voiceId as any);
      }
    }

    let response = `Now speaking as **${name}**`;
    if (personality) {
      response += ` (${personality})`;
    }
    if (voice) {
      response += `. Using ${voice} voice.`;
    }
    response += '\n\nFumbleBot will respond in character until you use fumble_clear_role.';

    return {
      content: [{ type: 'text', text: response }],
    };
  }

  private async clearRole(args: Record<string, unknown>): Promise<MCPToolResult> {
    const { guildId } = args as { guildId: string };

    const hadRole = this.activeRoles.has(guildId);
    this.activeRoles.delete(guildId);

    // Reset voice to default
    if (this.deepgramTTS) {
      this.deepgramTTS.setVoice('aura-orion-en');
    }

    return {
      content: [{
        type: 'text',
        text: hadRole
          ? 'Role cleared. Returning to default FumbleBot persona with Orion voice.'
          : 'No active role to clear.',
      }],
    };
  }

  private async listVoices(): Promise<MCPToolResult> {
    const voiceList = Object.entries(VOICE_DESCRIPTIONS)
      .map(([key, desc]) => `- **${key}**: ${desc}`)
      .join('\n');

    return {
      content: [{
        type: 'text',
        text: `Available TTS Voices:\n\n${voiceList}\n\nUse fumble_set_voice to change, or fumble_assume_role to set a voice for an NPC character.`,
      }],
    };
  }
}

export const voiceHandler = new VoiceHandler();
