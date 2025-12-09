# Adventure Terminal Integration Plan

## Overview

Integrate the Adventure Terminal system through Core to enable text-based adventures in Discord. The terminal provides a shared, persistent container environment that FumbleBot can use to run text-based games and interactive experiences.

## Architecture

```
Discord User → /adventure command → Terminal Service → Core API → Docker Container
                                          ↓
                              Discord Thread/Channel ← Output Display
```

### Key Components

1. **Terminal Service** (`src/services/terminal/`) - Manages terminal sessions per guild/channel
2. **Adventure Commands** (`src/services/discord/commands/slash/adventure.ts`) - Discord slash commands
3. **Output Handler** - Formats and displays terminal output in Discord

## SDK Integration

The `@crit-fumble/core-fumblebot` SDK (v0.6.0) already provides:

### Types
- `TerminalStartRequest` - Start a terminal (guildId, channelId, userId, userName)
- `TerminalStartResponse` - Container ID, status, port, WebSocket URL
- `TerminalExecRequest` - Execute command (guildId, channelId, command, timeout)
- `TerminalExecResponse` - stdout, stderr, exitCode, executionTime
- `TerminalStatusResponse` - Container exists, status, uptime
- `TerminalSessionInfo` - Session listing info

### Client Methods
- `terminalStart()` - Start a new terminal container
- `terminalStop()` - Stop and remove container
- `terminalStatus()` - Check container status
- `terminalExec()` - Execute a command
- `terminalSessions()` - List active sessions

## Implementation Plan

### Phase 1: Terminal Service

Create `src/services/terminal/terminal-service.ts`:

```typescript
class TerminalService {
  // Track active terminal sessions per guild/channel
  private sessions: Map<string, TerminalSession>;

  // Start a terminal for a channel
  async start(guildId: string, channelId: string, userId: string): Promise<TerminalStartResponse>;

  // Execute a command in the terminal
  async exec(guildId: string, channelId: string, command: string): Promise<TerminalExecResponse>;

  // Get terminal status
  async getStatus(guildId: string, channelId: string): Promise<TerminalStatusResponse>;

  // Stop a terminal
  async stop(guildId: string, channelId: string): Promise<void>;

  // List all active terminals for a guild
  async listSessions(guildId: string): Promise<TerminalSessionInfo[]>;
}
```

Key features:
- Session key: `${guildId}:${channelId}` (one terminal per channel)
- Automatic reconnection handling
- Output buffering for Discord message formatting

### Phase 2: Discord Commands

Create `/adventure` slash command with subcommands:

| Subcommand | Description | Options |
|------------|-------------|---------|
| `/adventure start` | Start a terminal session in this channel | None |
| `/adventure stop` | Stop the current terminal session | None |
| `/adventure status` | Check terminal status | None |
| `/adventure exec` | Execute a command | `command` (string, required) |
| `/adventure list` | List active terminals in this server | None |

### Phase 3: Output Formatting

Terminal output formatting for Discord:

```typescript
function formatTerminalOutput(response: TerminalExecResponse): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(response.exitCode === 0 ? 0x57F287 : 0xED4245)
    .setTitle('Terminal Output');

  if (response.stdout) {
    // Truncate to fit Discord embed limits
    const output = response.stdout.slice(0, 4000);
    embed.setDescription(`\`\`\`\n${output}\n\`\`\``);
  }

  if (response.stderr) {
    embed.addFields({ name: 'Errors', value: `\`\`\`\n${response.stderr.slice(0, 1000)}\n\`\`\`` });
  }

  embed.setFooter({ text: `Exit: ${response.exitCode} | ${response.executionTime}ms` });

  return embed;
}
```

### Phase 4: Interactive Mode (Future Enhancement)

For more immersive text adventures, consider:
- Create a dedicated thread for terminal sessions
- Use message collectors to capture user input without requiring `/adventure exec`
- Display output inline as the adventure progresses
- Support for ANSI color codes → Discord formatting

## File Structure

```
src/services/terminal/
├── index.ts              # Exports
├── terminal-service.ts   # Main service
├── types.ts              # Local type definitions
└── output-formatter.ts   # Discord output formatting

src/services/discord/commands/slash/
└── adventure.ts          # Discord slash commands
```

## Discord Command Registration

Add to command registry in `src/services/discord/commands/slash/index.ts`:
- Import `adventureCommands` and `adventureHandler`
- Register `/adventure` command

## Error Handling

| Error Case | Response |
|------------|----------|
| No terminal running | "No terminal session active in this channel. Use `/adventure start`" |
| Terminal already running | "Terminal already running. Use `/adventure exec` to run commands" |
| Command timeout | "Command timed out after {timeout}ms" |
| Container error | "Terminal error: {error message}" |
| Core API unreachable | "Unable to connect to adventure server" |

## Testing Strategy

### Unit Tests
- Terminal service methods
- Output formatting
- Session key generation

### Integration Tests
- Core API communication
- Command execution flow

### E2E Tests
- Start → exec → stop flow
- Error handling scenarios

## SDK Updates Required

None - the SDK v0.6.0 already includes all necessary types and client methods.

## Permissions

- Any user can start a terminal in a channel they have access to
- Terminal runs isolated per channel (different channels = different containers)
- Admin override to force-stop terminals

## Implementation Order

1. [ ] Create terminal service with Core API integration
2. [ ] Create `/adventure` slash commands
3. [ ] Implement output formatting
4. [ ] Register commands with Discord
5. [ ] Add unit tests
6. [ ] Add integration tests
7. [ ] Test in development Discord server

## Estimated Scope

- Terminal Service: ~150 lines
- Discord Commands: ~200 lines
- Output Formatter: ~50 lines
- Tests: ~200 lines
- Total: ~600 lines of new code
