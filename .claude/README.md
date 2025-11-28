# Claude Code Project Configuration

## Agent Docs
All docs created by agents are to be created and maintained in docs\agent on each iteration. Confirm conflicting information against the user written docs at the root of docs\, and ask if the user written docs need clarification or don't match the implimentation.

## Integration Tests
Use integration tests frequently and review their results for success and sanity. If the screenshot or video capture does not match the screen expected to be rendered in the test, or the test takes a very long time to run, then something is wrong.

## MCP Server Setup

This project includes an MCP (Model Context Protocol) server for running Playwright tests in the background during development sessions.

### Quick Start

1. **Start the MCP server:**
   ```bash
   npm run mcp:up
   ```

2. **Verify it's running:**
   ```bash
   npm run mcp:status
   ```

3. **Use it from Claude Code:**
   The MCP server is now available at `http://localhost:3333`

### Available MCP Tools

The server provides these tools for background test execution:

1. **run_playwright_tests** - Start a test run in the background
2. **get_test_status** - Check test execution status
3. **get_test_output** - View test logs
4. **list_test_runs** - List all test runs
5. **get_test_artifacts** - Get screenshots/videos/traces

### Manual Testing

You can test the MCP server manually:

```bash
# Check health
curl http://localhost:3333/health

# List available tools
curl -X POST http://localhost:3333/mcp/tools/list \
  -H "Content-Type: application/json"

# Run a test
curl -X POST http://localhost:3333/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "run_playwright_tests",
    "arguments": {
      "testFile": "tests/integration/09-auth-debug.spec.ts",
      "project": "chromium"
    }
  }'
```

### Using the CLI Client

```bash
# Run tests
node mcp-server/client.js run tests/integration/09-auth-debug.spec.ts

# Check status
node mcp-server/client.js status <test-id>

# List runs
node mcp-server/client.js list

# View artifacts
node mcp-server/client.js artifacts <test-id>
```

### Using Helper Functions

```javascript
const mcp = require('./mcp-server/helpers');

// Check if server is running
await mcp.checkHealth();

// Run auth debug test
const testId = await mcp.runAuthDebugTest();

// Check status later
const status = await mcp.getTestStatus(testId);

// Or wait for completion
const result = await mcp.runTestAndWait(
  'tests/integration/09-auth-debug.spec.ts'
);
```

### Stopping the Server

```bash
npm run mcp:down
```

## Configuration Files

- `.claude/mcp-servers.json` - MCP server configuration
- `mcp-server/` - Server implementation
- `docker-compose.test.yml` - Docker configuration

## Documentation

- [MCP Server README](../mcp-server/README.md)
- [MCP Integration Guide](../docs/agent/testing/MCP_INTEGRATION.md)
- [Docker Test Capture](../docs/agent/testing/DOCKER_TEST_CAPTURE.md)
- [Authentication Testing](../docs/agent/testing/AUTH_TESTING_GUIDE.md)