# Voice Assistant & MCP Testing Guide

**Date**: 2025-12-02
**Status**: Tests created, ready for execution

---

## Test Suite Overview

Comprehensive test suite for FumbleBot's voice assistant and MCP server integration.

### Test Coverage

| Category | Tests | Status |
|----------|-------|--------|
| **Voice Unit Tests** | deepgram-tts.test.ts | ✅ Created |
| **Voice Unit Tests** | deepgram-listener.test.ts | ✅ Created |
| **MCP Unit Tests** | fumblebot-mcp-server.test.ts | ✅ Created |
| **Voice Integration** | voice-assistant-integration.test.ts | ✅ Created |

---

## Test Files Created

### 1. Unit Tests

#### [tests/unit/voice/deepgram-tts.test.ts](tests/unit/voice/deepgram-tts.test.ts)
Tests Deepgram text-to-speech functionality:
- Configuration and voice selection
- Available voices (12 voices: male/female, American/British/Irish)
- API key validation
- Request options (validates mp3 encoding fix)
- Multiple audio encoding formats

**Key Test**: Validates fix for Deepgram TTS format error
- Ensures `container` parameter not sent for mp3 encoding
- Tests all supported encodings: linear16, mp3, opus, flac, aac

#### [tests/unit/voice/deepgram-listener.test.ts](tests/unit/voice/deepgram-listener.test.ts)
Tests wake word detection and transcription handling:
- Wake word detection ("hey fumblebot", "hey fumble bot")
- Case-insensitive matching
- Command extraction after wake word
- Final vs interim transcription prioritization
- Audio downsampling (48kHz stereo → 16kHz mono)

**Key Test**: Validates fix for wake word timing
- Tests 2-second delay before closing connection
- Ensures final transcriptions arrive within window

#### [tests/unit/mcp/fumblebot-mcp-server.test.ts](tests/unit/mcp/fumblebot-mcp-server.test.ts)
Tests MCP server tool discovery and integration:
- 8 tool categories verification
- Tool naming conventions
- Voice assistant integration points
- Dice rolling patterns
- External TTRPG site support (5e.tools, D&D Beyond, FoundryVTT KB)

### 2. Integration Tests

#### [tests/integration/voice/voice-assistant-integration.test.ts](tests/integration/voice/voice-assistant-integration.test.ts)
Tests complete voice command flow:
- Full voice command cycle (speech → transcription → AI → TTS → response)
- Mode switching (transcribe ↔ assistant)
- Bot presence indicators
- MCP tool routing
- Session lifecycle
- Error handling
- Timing and latency validation

**Key Tests**:
- Bot presence shows "Transcription In Progress" (transcribe mode)
- Bot presence shows "Voice Assistant Active" (assistant mode)
- Presence resets to "Crit-Fumble Gaming" when session ends
- Uses "Listening" activity type for voice modes
- Validates "Ready!" sound plays before listening starts

---

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### Watch Mode
```bash
npm run test:watch
```

### With Coverage
```bash
npm run test:coverage
```

### Individual Test Files
```bash
npx vitest tests/unit/voice/deepgram-tts.test.ts
npx vitest tests/unit/voice/deepgram-listener.test.ts
npx vitest tests/unit/mcp/fumblebot-mcp-server.test.ts
npx vitest tests/integration/voice/voice-assistant-integration.test.ts
```

---

##Configuration

### [tests/setup.ts](tests/setup.ts)
Global test setup file with:
- Environment variable mocks
- Prisma client mocks
- Discord/Core API response generators
- Test utilities (mock requests/responses)
- Fetch polyfill for Windows Node.js

### [.env.test](.env.test)
Test environment variables:
- Mock API keys (safe for testing)
- Test guild IDs
- In-memory database
- Local service URLs

**Note**: `.env.test` should be added to `.gitignore` if it contains real credentials

---

## Test Scenarios Covered

### Voice Assistant Flow
1. **User speaks**: "Hey FumbleBot, roll d20"
2. **Deepgram transcribes**: Real-time speech-to-text
3. **Wake word detected**: Pattern matching on final transcript
4. **Command extracted**: Text after wake word
5. **MCP tool routed**: Sends to `fumble_roll_dice`
6. **AI processes**: Generates response
7. **TTS synthesizes**: Deepgram Aura generates audio
8. **Bot speaks**: Plays audio in voice channel

### Bot Presence Indicators
- ✅ Shows "Transcription In Progress" when `/voice transcribe` active
- ✅ Shows "Voice Assistant Active" when `/voice assistant` active
- ✅ Resets to "Crit-Fumble Gaming" when session ends
- ✅ Uses "Listening" activity type for voice modes
- ✅ Uses "Playing" activity type for idle state

### MCP Tool Routing
- ✅ Dice rolls → `fumble_roll_dice`
- ✅ Spell lookups → `kb_search`
- ✅ NPC generation → `fumble_generate_npc`
- ✅ External fetches → `web_fetch`
- ✅ Foundry operations → `foundry_screenshot`, `foundry_chat`

### Error Handling
- ✅ Missing API keys handled gracefully
- ✅ TTS synthesis failures fall back to text
- ✅ Wake word false positives filtered
- ✅ Connection timing errors fixed

---

## Known Issues

### 1. Existing Test Setup Conflicts
The existing [tests/setup.ts](tests/setup.ts) uses complex global mocks that may conflict with new tests. Consider:
- Creating separate setup files for unit vs integration tests
- Using conditional mocks based on test type
- Refactoring setup to be less invasive

### 2. Test Isolation
Some tests may require:
- Deepgram API key for real TTS testing
- Discord bot token for voice channel integration
- Running Discord bot for E2E tests

**Recommendation**: Use mocks for unit tests, real services for integration/E2E tests

---

## Next Steps

1. **Fix Test Setup Conflicts**
   - Resolve vitest runner issues
   - Refactor global mocks

2. **Add E2E Tests**
   - Test actual voice commands in Discord
   - Test MCP server with real Claude Desktop
   - Test presence indicators visible in Discord

3. **Add Performance Tests**
   - Measure TTS latency (< 3s target)
   - Measure wake word detection time
   - Measure transcription accuracy

4. **Add Load Tests**
   - Multiple simultaneous voice sessions
   - Concurrent MCP tool calls
   - High-frequency dice rolls

5. **Add Visual Tests**
   - Screenshot Discord presence indicator
   - Verify bot shows "Listening" icon
   - Validate embed formatting

---

## Test Validation Checklist

Before deployment, verify:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Bot presence shows correct text
- [ ] Bot presence uses correct activity type
- [ ] Wake word detection works in production
- [ ] TTS synthesizes without errors
- [ ] "Ready!" sound plays before listening
- [ ] Final transcriptions arrive before connection closes
- [ ] MCP tools route correctly
- [ ] Transcript delivered via DM

---

## Documentation References

- [Voice Commands](../src/services/discord/commands/slash/voice.ts)
- [Deepgram TTS](../src/services/discord/voice/deepgram-tts.ts)
- [Deepgram Listener](../src/services/discord/voice/deepgram-listener.ts)
- [Voice Assistant](../src/services/discord/voice/assistant.ts)
- [MCP Server](../src/mcp/fumblebot-mcp-server.ts)
- [MCP Tools Prompt](../src/services/discord/voice/mcp-tools-prompt.ts)

---

**Last Updated**: 2025-12-02
**Test Framework**: Vitest 4.0.14
**Coverage**: Unit + Integration
**Status**: Ready for execution after setup fixes
