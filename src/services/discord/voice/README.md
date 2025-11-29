# FumbleBot Voice Integration

Voice channel integration for FumbleBot Discord bot, enabling sound effect playback from RPG assets and voice assistant with wake word detection.

## Features

### ✅ Implemented
- Voice channel join/leave
- Voice connection management
- Audio playback from URLs, files, and buffers
- Basic voice commands (`/voice join`, `/voice leave`, `/voice status`)
- **Voice Assistant** with "Hey FumbleBot" wake word detection
- **OpenAI Whisper** transcription for voice commands
- Voice commands: `/voice listen`, `/voice unlisten`

### 🚧 TODO - Phase 1
- [ ] RPG Asset database integration
- [ ] Sound effect playback command (`/voice play`)
- [ ] Asset autocomplete from database
- [ ] Volume control
- [ ] Queue system for multiple sounds
- [ ] OpenAI TTS responses (currently disabled for cost)

### 📋 TODO - Phase 2
- [ ] Music streaming
- [ ] Ambient sound loops
- [ ] Playlist support
- [ ] Sound effect triggers from Foundry events
- [ ] Session transcription mode

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Discord Voice                       │
│                                                      │
│  User: /voice join                                   │
│           ↓                                          │
│  ┌──────────────────────────────────────────┐      │
│  │  Voice Commands (voice.ts)               │      │
│  │  • Join/Leave channel                     │      │
│  │  • Play sound effects                     │      │
│  │  • Stop playback                          │      │
│  └──────────────────────────────────────────┘      │
│           ↓                                          │
│  ┌──────────────────────────────────────────┐      │
│  │  Voice Client (client.ts)                │      │
│  │  • Manages voice connections              │      │
│  │  • Audio player control                   │      │
│  │  • Playback from URLs/files/buffers       │      │
│  └──────────────────────────────────────────┘      │
│           ↓                                          │
│  ┌──────────────────────────────────────────┐      │
│  │  Sound Service (sound-service.ts)        │      │
│  │  • Asset lookup                           │      │
│  │  • Database queries                       │      │
│  │  • Audio streaming                        │      │
│  └──────────────────────────────────────────┘      │
│           ↓                                          │
│  ┌──────────────────────────────────────────┐      │
│  │  RPG Assets Database                      │      │
│  │  • Sound effects (tag: "sound")           │      │
│  │  • Music tracks (tag: "music")            │      │
│  │  • Ambient sounds (tag: "ambient")        │      │
│  └──────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────┘
```

## Commands

### `/voice join`
Join your current voice channel.

**Example:**
```
User joins a voice channel
User: /voice join
Bot: 🎙️ Joined **General Voice**
```

### `/voice leave`
Leave the current voice channel.

**Example:**
```
User: /voice leave
Bot: 👋 Left voice channel
```

### `/voice status`
Check voice connection status.

**Example:**
```
User: /voice status
Bot: 📊 **Voice Status**: Connected to **General Voice**
```

### `/voice play <asset> [volume]`
Play a sound effect from RPG assets.

**Parameters:**
- `asset` (required) - Asset ID or name (autocomplete enabled)
- `volume` (optional) - Volume level 0.0 to 1.0 (default: 0.5)

**Example:**
```
User: /voice play asset:Sword Swing volume:0.7
Bot: ✅ Played **Sword Swing**
```

**Status:** 🚧 Stubbed - Needs database integration

### `/voice stop`
Stop current audio playback.

**Example:**
```
User: /voice stop
Bot: ⏹️ Stopped playback
```

### `/voice listen`
Start listening for "Hey FumbleBot" wake word. Currently only available in test guild.

**Example:**
```
User: /voice listen
Bot: 🎧 Voice Assistant Active
     Now listening in **General Voice**

     Wake Word: "Hey FumbleBot"
     Example Commands:
     • "Hey FumbleBot, roll d20"
     • "Hey FumbleBot, roll 2d6 plus 3"
     • "Hey FumbleBot, roll initiative"
     • "Hey FumbleBot, goodbye"
```

### `/voice unlisten`
Stop listening for voice commands.

**Example:**
```
User: /voice unlisten
Bot: 🔇 Voice assistant stopped. No longer listening for wake word.
```

## Voice Assistant

The voice assistant uses OpenAI Whisper for speech-to-text transcription. It listens for the wake word "Hey FumbleBot" followed by a command.

### Architecture

```
User speaks "Hey FumbleBot, roll d20"
           ↓
┌─────────────────────────────────────┐
│  VoiceListener (listener.ts)        │
│  • Receives Discord audio stream    │
│  • Converts PCM to WAV              │
│  • Sends to OpenAI Whisper API      │
│  • Detects wake word in transcript  │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  VoiceAssistant (assistant.ts)      │
│  • Parses voice command             │
│  • Executes dice rolls, etc.        │
│  • (Optional) Speaks response       │
└─────────────────────────────────────┘
```

### Supported Wake Words
- "Hey FumbleBot"
- "Hey Fumble Bot"
- "Hey Fumble"
- "FumbleBot"
- "Okay FumbleBot"

### Cost Estimates
- **Whisper API**: $0.006/minute (~$0.36/hour of continuous listening)
- **TTS (disabled)**: $0.015/1K characters

## Database Integration

### RpgAsset Table
Sound effects are stored as RPG assets with the `"sound"` tag:

```typescript
interface RpgAsset {
  id: string;
  name: string;
  url: string; // Direct link to audio file
  tags: string[]; // Must include "sound"
  metadata?: {
    duration?: number; // Audio length in seconds
    volume?: number; // Default volume 0.0 to 1.0
    assetType?: 'sound' | 'music' | 'ambient';
  };
}
```

### Tag System
- **`sound`** - Short sound effects (sword swings, footsteps, etc.)
- **`music`** - Background music tracks
- **`ambient`** - Ambient sounds (rain, wind, tavern noise)

### Example Assets
```sql
INSERT INTO rpg_assets (name, url, tags, metadata) VALUES
('Sword Swing', 'https://cdn.crit-fumble.com/sounds/sword-swing.mp3', ARRAY['sound', 'combat', 'melee'], '{"duration": 1.5, "volume": 0.7}'),
('Magic Spell Cast', 'https://cdn.crit-fumble.com/sounds/magic-cast.mp3', ARRAY['sound', 'magic', 'spell'], '{"duration": 2.0, "volume": 0.6}'),
('Tavern Ambience', 'https://cdn.crit-fumble.com/sounds/tavern-ambient.mp3', ARRAY['ambient', 'tavern'], '{"duration": 120.0, "volume": 0.3}');
```

## Implementation Checklist

### Phase 1: Basic Sound Effects
- [x] Voice client with join/leave functionality
- [x] Command structure (`/voice` commands)
- [x] Stub autocomplete handler
- [ ] Database integration for asset lookup
- [ ] Asset autocomplete from database
- [ ] Sound effect playback from RPG assets
- [ ] Volume control implementation

### Phase 2: Advanced Features
- [ ] Music streaming with playlist support
- [ ] Ambient sound loops
- [ ] Foundry event triggers
- [ ] Queue system for multiple sounds
- [ ] Voice activity detection

### Phase 3: Foundry Integration
- [ ] Combat event sounds (attacks, spells)
- [ ] Scene change ambience
- [ ] Dice roll sound effects
- [ ] Chat message notifications
- [ ] Dynamic volume based on game state

## Dependencies

Required npm packages:
```json
{
  "@discordjs/voice": "^0.17.0",
  "discord.js": "^14.16.3"
}
```

**Note:** These dependencies need to be added to `src/packages/fumblebot/package.json`

## Usage Example

```typescript
import { voiceClient } from './discord/voice';
import { soundService } from './discord/voice/sound-service';

// Join voice channel
const channel = guild.channels.cache.get(channelId);
await voiceClient.joinChannel(channel);

// Play sound effect
await soundService.playSoundEffect({
  guildId: guild.id,
  assetId: 'asset-sword-swing',
  assetUrl: 'https://cdn.crit-fumble.com/sounds/sword-swing.mp3',
  volume: 0.7
});

// Leave channel
await voiceClient.leaveChannel(guild.id);
```

## Configuration

Voice integration is configured per RPG system in the FumbleBot settings:

```typescript
interface FumbleBotSettings {
  voiceEnabled?: boolean; // Default: true
  voiceDefaultVolume?: number; // Default: 0.5 (0.0 to 1.0)
}
```

## Testing

Test the voice commands in Discord:
```
1. Join a voice channel
2. /voice join
3. /voice status
4. /voice play (when implemented)
5. /voice stop
6. /voice leave
```

## Limitations

- Bot can only be in one voice channel per guild at a time
- Audio must be in a supported format (mp3, ogg, wav)
- Maximum audio file size depends on hosting
- Voice activity detection not yet implemented

## Future Enhancements

- Text-to-speech for NPC dialogue
- Real-time voice effects (echo, reverb)
- Voice morphing for character voices
- Voice recording for session notes
- Automatic transcription
