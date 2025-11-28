# MCP Server for Background Test Execution

## Overview

Model Context Protocol (MCP) server that enables Claude Code to run Playwright integration tests in the background while continuing development work. Tests execute in isolated Docker containers with full capture capabilities.

## Features

- **Asynchronous test execution**: Run tests without blocking development
- **Queue management**: Handle multiple concurrent test runs
- **Real-time monitoring**: Check test status and view live output
- **Artifact tracking**: Automatically catalog screenshots, videos, and traces
- **Docker orchestration**: Spawn and manage test containers dynamically
- **RESTful API**: Simple HTTP interface for tool invocation

## Quick Start

### 1. Build and Start MCP Server

```bash
# Build the MCP server container
npm run mcp:build

# Start the server
npm run mcp:up

# Check server health
npm run mcp:status
```

### 2. Run Tests via MCP

```bash
# Using the CLI client
node mcp-server/client.js run tests/integration/09-auth-debug.spec.ts

# Returns immediately with test ID:
# Test ID: abc123def456
# Status: running
# Message: Test run started in background
```

### 3. Monitor Test Execution

```bash
# Check test status
node mcp-server/client.js status abc123def456

# View live output
node mcp-server/client.js output abc123def456 --tail=50

# List all test runs
node mcp-server/client.js list

# View artifacts
node mcp-server/client.js artifacts abc123def456
```

## Architecture

```
┌─────────────────────────────────────────┐
│ Claude Code / Developer                 │
└───────────────┬─────────────────────────┘
                │ HTTP Requests
                ▼
┌─────────────────────────────────────────┐
│ MCP Server (Port 3333)                  │
│ ┌─────────────────────────────────────┐ │
│ │ Express REST API                    │ │
│ │ - run_playwright_tests              │ │
│ │ - get_test_status                   │ │
│ │ - get_test_output                   │ │
│ │ - list_test_runs                    │ │
│ │ - get_test_artifacts                │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Test Run Manager                    │ │
│ │ - In-memory test tracking           │ │
│ │ - Docker container orchestration    │ │
│ │ - Output streaming & logging        │ │
│ │ - Artifact scanning                 │ │
│ └─────────────────────────────────────┘ │
└───────────────┬─────────────────────────┘
                │ Docker API
                ▼
┌─────────────────────────────────────────┐
│ Docker (via /var/run/docker.sock)      │
│ ┌─────────────────────────────────────┐ │
│ │ Test Capture Containers             │ │
│ │ - Playwright + Chromium/Firefox     │ │
│ │ - ffmpeg, imagemagick, etc.         │ │
│ │ - Xvfb for headless video           │ │
│ └─────────────────────────────────────┘ │
└───────────────┬─────────────────────────┘
                │ Volumes
                ▼
┌─────────────────────────────────────────┐
│ Host Filesystem                         │
│ - tests/screenshots/                    │
│ - tests/videos/                         │
│ - tests/results/                        │
│ - playwright-report/                    │
└─────────────────────────────────────────┘
```

## API Reference

### Available Tools

#### `run_playwright_tests`

Start a Playwright test run in the background.

**Parameters:**
- `testFile` (string, optional): Path to test file (e.g., "tests/integration/09-auth-debug.spec.ts")
- `project` (string, default: "chromium"): Browser project (chromium|firefox|webkit)
- `grep` (string, optional): Filter tests by name pattern
- `processCaptures` (boolean, default: true): Enable automatic video/screenshot processing
- `timeout` (number, default: 60000): Test timeout in milliseconds

**Returns:**
```json
{
  "testId": "abc123def456",
  "status": "running",
  "message": "Test run started in background",
  "config": { ... }
}
```

#### `get_test_status`

Get status of a running or completed test run.

**Parameters:**
- `testId` (string, required): Test run ID

**Returns:**
```json
{
  "id": "abc123def456",
  "status": "passed",
  "duration": 45000,
  "exitCode": 0,
  "outputLines": 234,
  "artifacts": {
    "screenshots": ["path/to/screenshot1.png", ...],
    "videos": ["path/to/video1.mp4", ...],
    "traces": [],
    "report": "playwright-report/index.html"
  }
}
```

#### `get_test_output`

Get output logs from a test run.

**Parameters:**
- `testId` (string, required): Test run ID
- `tail` (number, optional): Return last N lines of output

**Returns:** Plain text output with timestamps

#### `list_test_runs`

List all test runs with optional status filter.

**Parameters:**
- `status` (string, optional): Filter by status (queued|running|passed|failed)
- `limit` (number, default: 20): Maximum number of results

**Returns:** Array of test run objects

#### `get_test_artifacts`

Get list of artifacts from a test run.

**Parameters:**
- `testId` (string, required): Test run ID

**Returns:** Artifacts object with screenshots, videos, traces, and report paths

#### `cfg_login`

Run login integration test, create an authenticated session, and return screenshot of the login UI.

**Parameters:**
- `viewport` (string, default: "desktop"): Viewport size - "desktop" (1920x1080) or "mobile" (375x667)
- `theme` (string, default: "dark"): Theme mode - "light" or "dark"

**Returns:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{
        \"success\": true,
        \"message\": \"Login test completed successfully\",
        \"viewport\": \"desktop\",
        \"theme\": \"dark\",
        \"timestamp\": 1234567890,
        \"sessionId\": \"abc123def456\",
        \"session\": {
          \"playerId\": \"player-id\",
          \"username\": \"mcp_user_1234567890\",
          \"email\": \"mcp-login-1234567890@crit-fumble.test\",
          \"critCoins\": 150,
          \"hasToken\": true
        }
      }"
    },
    {
      "type": "image",
      "data": "<base64-encoded-png>",
      "mimeType": "image/png"
    }
  ]
}
```

**Note:** The session token is stored on the MCP server and can be used for subsequent authenticated requests.

#### `cfg_logout`

Run logout integration test using a stored session token, invalidate the session, and return screenshot of the logged-out state.

**Parameters:**
- `viewport` (string, default: "desktop"): Viewport size - "desktop" (1920x1080) or "mobile" (375x667)
- `sessionId` (string, optional): Session ID to logout from. If not provided, uses the most recent active session.

**Returns:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{
        \"success\": true,
        \"message\": \"Logout test completed successfully\",
        \"viewport\": \"desktop\",
        \"timestamp\": 1234567890,
        \"sessionId\": \"abc123def456\",
        \"username\": \"mcp_user_1234567890\"
      }"
    },
    {
      "type": "image",
      "data": "<base64-encoded-png>",
      "mimeType": "image/png"
    }
  ]
}
```

**Note:** This invalidates the session on the MCP server. The session token can no longer be used.

#### `get_session_info`

Get information about a stored session.

**Parameters:**
- `sessionId` (string, optional): Session ID to query. If not provided, returns info about the most recent active session.

**Returns:**
```json
{
  "sessionId": "abc123def456",
  "playerId": "player-id",
  "username": "mcp_user_1234567890",
  "email": "mcp-login-1234567890@crit-fumble.test",
  "critCoins": 150,
  "storyCredits": 0,
  "createdAt": "2025-01-23T10:00:00.000Z",
  "lastUsedAt": "2025-01-23T10:05:00.000Z",
  "isActive": true,
  "hasToken": true
}
```

#### `list_sessions`

List all sessions stored on the MCP server.

**Parameters:**
- `includeInactive` (boolean, default: false): Include invalidated/logged-out sessions

**Returns:**
```json
{
  "count": 2,
  "totalSessions": 5,
  "sessions": [
    {
      "sessionId": "abc123def456",
      "playerId": "player-id",
      "username": "mcp_user_1234567890",
      "email": "mcp-login-1234567890@crit-fumble.test",
      "critCoins": 150,
      "storyCredits": 0,
      "createdAt": "2025-01-23T10:00:00.000Z",
      "lastUsedAt": "2025-01-23T10:05:00.000Z",
      "isActive": true,
      "hasToken": true
    }
  ]
}
```

### Health Check Endpoint

```bash
GET http://localhost:3333/health

Response:
{
  "status": "healthy",
  "uptime": 3600,
  "activeTests": 2,
  "totalTests": 15
}
```

## CLI Client Usage

The MCP client provides a command-line interface for interacting with the server.

### Run Tests

```bash
# Run specific test file
node mcp-server/client.js run tests/integration/09-auth-debug.spec.ts

# Run with options
node mcp-server/client.js run tests/integration/08-user-login-flow.spec.ts --project=chromium

# Run with grep filter
node mcp-server/client.js run --grep="should login successfully"

# Run all tests
node mcp-server/client.js run
```

### Monitor Tests

```bash
# Get test status
node mcp-server/client.js status abc123def456

# View last 50 lines of output
node mcp-server/client.js output abc123def456 --tail=50

# Stream full output
node mcp-server/client.js output abc123def456
```

### List & Manage

```bash
# List all test runs
node mcp-server/client.js list

# List only running tests
node mcp-server/client.js list --status=running

# List only failed tests
node mcp-server/client.js list --status=failed

# Limit results
node mcp-server/client.js list --limit=10
```

### View Artifacts

```bash
# Get artifacts for test run
node mcp-server/client.js artifacts abc123def456

# Output:
# Screenshots (3):
#   tests/screenshots/user-login-flow/1234567890/01-login-page.png
#   tests/screenshots/user-login-flow/1234567890/02-dashboard.png
#   ...
# Videos (1):
#   tests/videos/chromium/test-abc123.mp4
# Report:
#   playwright-report/index.html
```

### Run Login/Logout Tests with Screenshots and Session Management

```bash
# Run login test (desktop, dark mode) - creates a session
node mcp-server/client.js cfgLogin

# Run login test (mobile, light mode)
node mcp-server/client.js cfgLogin --viewport=mobile --theme=light

# Check current session info
node mcp-server/client.js sessionInfo

# List all active sessions
node mcp-server/client.js listSessions

# List all sessions including logged out ones
node mcp-server/client.js listSessions --includeInactive

# Run logout test using most recent session (desktop)
node mcp-server/client.js cfgLogout

# Run logout test for specific session (mobile)
node mcp-server/client.js cfgLogout --viewport=mobile --sessionId=abc123def456

# Output (login):
# Running cfg-login test...
# Login Test Result:
#   Status: SUCCESS
#   Message: Login test completed successfully
#   Viewport: desktop
#   Theme: dark
#   Timestamp: 1234567890
#   Session ID: abc123def456
#
# Session Created:
#   Player ID: player-id
#   Username: mcp_user_1234567890
#   Email: mcp-login-1234567890@crit-fumble.test
#   Crit-Coins: 150
#   Has Token: Yes
#
#   Screenshot captured and returned in response
#   Screenshot size: 123456 bytes (base64)

# Output (logout):
# Running cfg-logout test...
# Logout Test Result:
#   Status: SUCCESS
#   Message: Logout test completed successfully
#   Viewport: desktop
#   Session ID: abc123def456
#   Username: mcp_user_1234567890
#   Timestamp: 1234567890
#
#   Screenshot captured and returned in response
#   Screenshot size: 123456 bytes (base64)
```

## Usage from Claude Code

As Claude Code, I can now run tests in the background while we continue working:

### Example Workflow

```typescript
// 1. Start a test run
const response = await fetch('http://localhost:3333/mcp/tools/call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'run_playwright_tests',
    arguments: {
      testFile: 'tests/integration/09-auth-debug.spec.ts',
      project: 'chromium'
    }
  })
});

const { testId } = JSON.parse((await response.json()).content[0].text);

// 2. Continue development work...
// ... make code changes ...
// ... answer user questions ...

// 3. Check test status later
const statusResponse = await fetch('http://localhost:3333/mcp/tools/call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'get_test_status',
    arguments: { testId }
  })
});

const status = JSON.parse((await statusResponse.json()).content[0].text);
console.log(`Test ${testId}: ${status.status} (${status.duration}ms)`);
```

## Configuration

### Environment Variables

Set in `.env` file or docker-compose.test.yml:

```env
# MCP Server
MCP_PORT=3333
MCP_HOST=0.0.0.0

# Application
DATABASE_URL=postgresql://user:pass@host:5432/crit_fumble
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
PLAYWRIGHT_BASE_URL=http://host.docker.internal:3000

# OAuth (for auth tests)
DISCORD_CLIENT_ID=your-discord-id
DISCORD_CLIENT_SECRET=your-discord-secret
GITHUB_CLIENT_ID=your-github-id
GITHUB_CLIENT_SECRET=your-github-secret
```

### Resource Limits

Adjust in [docker-compose.test.yml](../docker-compose.test.yml):

```yaml
deploy:
  resources:
    limits:
      cpus: '1'
      memory: 1G
```

## Troubleshooting

### MCP Server Won't Start

```bash
# Check if port 3333 is available
netstat -an | findstr 3333

# Check Docker is running
docker ps

# Check server logs
npm run mcp:logs
```

### Tests Won't Start

**Issue**: Docker socket permission denied

**Solution**: Ensure MCP server has access to `/var/run/docker.sock`:
```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

### Can't Connect to App

**Issue**: `ECONNREFUSED localhost:3000`

**Solution**: Use `host.docker.internal` in `PLAYWRIGHT_BASE_URL`:
```env
PLAYWRIGHT_BASE_URL=http://host.docker.internal:3000
```

### Test Artifacts Not Found

**Issue**: Artifacts array is empty after test completion

**Check**: Ensure volume mounts are correct in docker-compose.test.yml:
```yaml
volumes:
  - ./tests/screenshots:/app/tests/screenshots
  - ./tests/videos:/app/tests/videos
```

## npm Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run mcp:build` | Build MCP server container |
| `npm run mcp:up` | Start MCP server in background |
| `npm run mcp:down` | Stop MCP server |
| `npm run mcp:logs` | View MCP server logs |
| `npm run mcp:restart` | Restart MCP server |
| `npm run mcp:status` | Check MCP server health |

## API Examples

### Using curl

```bash
# Run tests
curl -X POST http://localhost:3333/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "run_playwright_tests",
    "arguments": {
      "testFile": "tests/integration/09-auth-debug.spec.ts",
      "project": "chromium"
    }
  }'

# Get status
curl -X POST http://localhost:3333/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_test_status",
    "arguments": { "testId": "abc123def456" }
  }'

# List test runs
curl -X POST http://localhost:3333/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "list_test_runs",
    "arguments": { "status": "running", "limit": 10 }
  }'

# Run login test with screenshot
curl -X POST http://localhost:3333/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cfg_login",
    "arguments": {
      "viewport": "desktop",
      "theme": "dark"
    }
  }'

# Run logout test with screenshot (uses most recent session)
curl -X POST http://localhost:3333/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cfg_logout",
    "arguments": {
      "viewport": "mobile"
    }
  }'

# Get current session info
curl -X POST http://localhost:3333/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_session_info",
    "arguments": {}
  }'

# List all sessions
curl -X POST http://localhost:3333/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "list_sessions",
    "arguments": {
      "includeInactive": true
    }
  }'
```

## UI Automation with Test IDs

The MCP server now supports **AI-driven UI automation** by exposing interactive elements through test IDs. Every MCP response includes:

1. **Screenshot** of the current UI state
2. **Element list** with all visible elements that have `data-testid` attributes
3. **Element metadata** including type, text content, position, and interactivity

### Element Detection

All MCP tools (`cfg_login`, `cfg_tap`, `cfg_fill`, `cfg_batch`) automatically extract page elements and return them in the response:

```json
{
  "elements": [
    {
      "testId": "discord-login-button",
      "tagName": "button",
      "type": null,
      "text": "Sign in with Discord",
      "placeholder": null,
      "value": null,
      "ariaLabel": "Sign in with Discord",
      "role": "button",
      "position": { "x": 100, "y": 200, "width": 200, "height": 40 },
      "isInteractive": true
    }
  ],
  "elementCount": 15
}
```

### cfg_tap - Click Elements

Tap/click any element by its test ID:

```bash
# Tap a button
node mcp-server/client.js cfgTap discord-login-button

# Tap with session (authenticated)
node mcp-server/client.js cfgTap profile-menu --sessionId=abc123

# Tap on mobile viewport
node mcp-server/client.js cfgTap menu-icon --viewport=mobile
```

**API Example:**
```bash
curl -X POST http://localhost:3333/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cfg_tap",
    "arguments": {
      "testId": "discord-login-button",
      "sessionId": "abc123",
      "viewport": "desktop"
    }
  }'
```

### cfg_fill - Fill Inputs

Fill any input field by its test ID:

```bash
# Fill a text input
node mcp-server/client.js cfgFill email-input user@example.com

# Fill with session
node mcp-server/client.js cfgFill search-box "game rules" --sessionId=abc123
```

**API Example:**
```bash
curl -X POST http://localhost:3333/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cfg_fill",
    "arguments": {
      "testId": "email-input",
      "value": "user@example.com",
      "viewport": "desktop"
    }
  }'
```

### cfg_batch - Execute Action Sequences

Execute multiple UI actions in sequence (tap, fill):

```bash
# Complete form submission flow
node mcp-server/client.js cfgBatch '[
  {"type":"fill","testId":"username-input","value":"testuser"},
  {"type":"fill","testId":"email-input","value":"test@example.com"},
  {"type":"tap","testId":"submit-button"}
]'

# With session
node mcp-server/client.js cfgBatch '[
  {"type":"tap","testId":"edit-profile"},
  {"type":"fill","testId":"bio-input","value":"Updated bio"},
  {"type":"tap","testId":"save-button"}
]' --sessionId=abc123
```

**API Example:**
```bash
curl -X POST http://localhost:3333/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cfg_batch",
    "arguments": {
      "actions": [
        {"type": "fill", "testId": "username-input", "value": "testuser"},
        {"type": "fill", "testId": "password-input", "value": "password123"},
        {"type": "tap", "testId": "login-button"}
      ],
      "viewport": "desktop"
    }
  }'
```

### AI Agent Workflow Example

Here's how an AI agent can use the MCP server to interact with your UI:

```typescript
// 1. Login and get session + elements
const loginResponse = await mcp.call('cfg_login', { viewport: 'desktop', theme: 'dark' });
const { sessionId, elements } = loginResponse;

// Agent sees: ["discord-login-button", "github-login-button", ...]

// 2. Click Discord login button
const tapResponse = await mcp.call('cfg_tap', {
  testId: 'discord-login-button',
  sessionId
});

// 3. After auth, agent sees new elements on dashboard
const { elements: dashboardElements } = tapResponse;
// ["profile-menu", "settings-button", "search-input", ...]

// 4. Perform multi-step workflow
const batchResponse = await mcp.call('cfg_batch', {
  actions: [
    { type: 'tap', testId: 'settings-button' },
    { type: 'fill', testId: 'display-name', value: 'AI Test User' },
    { type: 'tap', testId: 'save-settings' }
  ],
  sessionId
});

// 5. Each response includes updated screenshot + element list
```

### Benefits for AI Agents

1. **Self-Documenting UI**: Elements are automatically discovered, no hardcoded selectors
2. **Visual Feedback**: Every action returns a screenshot showing the result
3. **Context Awareness**: Element lists let agents know what actions are possible
4. **Batch Operations**: Execute complex flows in a single call
5. **Session Management**: Maintain authentication state across actions

## Related Documentation

- [Docker Test Capture](../docs/agent/testing/DOCKER_TEST_CAPTURE.md) - Test container setup
- [Authentication Testing](../docs/agent/testing/AUTH_TESTING_GUIDE.md) - Auth.js testing patterns
- [Playwright Config](../playwright.config.ts) - Test configuration

## Development

### Running Locally (without Docker)

```bash
cd mcp-server
npm install
npm start
```

Server will start on http://localhost:3333

### Adding New Tools

1. Add tool definition to `/mcp/tools/list` endpoint in [index.js](./index.js)
2. Add tool handler to `/mcp/tools/call` endpoint
3. Implement tool function
4. Add CLI command to [client.js](./client.js)
5. Update this README

## License

MIT
