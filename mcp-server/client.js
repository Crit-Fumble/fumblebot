#!/usr/bin/env node

/**
 * MCP Client CLI
 *
 * Command-line interface for interacting with the MCP server
 * Usage: node mcp-server/client.js <command> [options]
 */

const http = require('http');

const MCP_HOST = process.env.MCP_HOST || 'localhost';
const MCP_PORT = process.env.MCP_PORT || 3333;

/**
 * Make HTTP request to MCP server
 */
function mcpRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: MCP_HOST,
      port: MCP_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          resolve(data);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Call MCP tool
 */
async function callTool(name, args) {
  return mcpRequest('POST', '/mcp/tools/call', {
    name,
    arguments: args
  });
}

/**
 * Get server health
 */
async function getHealth() {
  return mcpRequest('GET', '/health');
}

/**
 * List available tools
 */
async function listTools() {
  return mcpRequest('POST', '/mcp/tools/list');
}

/**
 * CLI Commands
 */
const commands = {
  async health() {
    const health = await getHealth();
    console.log('MCP Server Health:');
    console.log(JSON.stringify(health, null, 2));
  },

  async tools() {
    const result = await listTools();
    console.log('Available Tools:');
    result.tools.forEach(tool => {
      console.log(`\n${tool.name}:`);
      console.log(`  ${tool.description}`);
    });
  },

  async run(testFile, options = {}) {
    console.log(`Starting test run: ${testFile || 'all tests'}`);

    const result = await callTool('run_playwright_tests', {
      testFile,
      project: options.project || 'chromium',
      grep: options.grep,
      processCaptures: options.processCaptures !== false,
      timeout: options.timeout
    });

    const response = JSON.parse(result.content[0].text);
    console.log('\nTest Started:');
    console.log(`  Test ID: ${response.testId}`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Message: ${response.message}`);

    return response.testId;
  },

  async status(testId) {
    if (!testId) {
      throw new Error('Test ID required');
    }

    const result = await callTool('get_test_status', { testId });
    const status = JSON.parse(result.content[0].text);

    console.log(`\nTest Run ${testId}:`);
    console.log(`  Status: ${status.status}`);
    console.log(`  Duration: ${Math.round(status.duration / 1000)}s`);
    console.log(`  Exit Code: ${status.exitCode}`);
    console.log(`  Output Lines: ${status.outputLines}`);
    console.log(`  Screenshots: ${status.artifacts.screenshots.length}`);
    console.log(`  Videos: ${status.artifacts.videos.length}`);

    if (status.error) {
      console.log(`  Error: ${status.error}`);
    }
  },

  async output(testId, tail) {
    if (!testId) {
      throw new Error('Test ID required');
    }

    const result = await callTool('get_test_output', { testId, tail });
    console.log(result.content[0].text);
  },

  async list(statusFilter, limit) {
    const result = await callTool('list_test_runs', {
      status: statusFilter,
      limit: limit || 20
    });

    const runs = JSON.parse(result.content[0].text);

    console.log(`\nTest Runs (${runs.length}):`);
    runs.forEach(run => {
      const duration = Math.round(run.duration / 1000);
      console.log(`\n${run.id}:`);
      console.log(`  Status: ${run.status}`);
      console.log(`  Duration: ${duration}s`);
      console.log(`  Config: ${JSON.stringify(run.config)}`);
    });
  },

  async artifacts(testId) {
    if (!testId) {
      throw new Error('Test ID required');
    }

    const result = await callTool('get_test_artifacts', { testId });
    const artifacts = JSON.parse(result.content[0].text);

    console.log(`\nArtifacts for ${testId}:`);
    console.log(`\nScreenshots (${artifacts.screenshots.length}):`);
    artifacts.screenshots.forEach(path => console.log(`  ${path}`));

    console.log(`\nVideos (${artifacts.videos.length}):`);
    artifacts.videos.forEach(path => console.log(`  ${path}`));

    console.log(`\nTraces (${artifacts.traces.length}):`);
    artifacts.traces.forEach(path => console.log(`  ${path}`));

    if (artifacts.report) {
      console.log(`\nReport: ${artifacts.report}`);
    }
  },

  async cfgLogin(options = {}) {
    console.log('Running cfg-login test...');

    const result = await callTool('cfg_login', {
      viewport: options.viewport || 'desktop',
      theme: options.theme || 'dark'
    });

    const textContent = JSON.parse(result.content[0].text);
    console.log('\nLogin Test Result:');
    console.log(`  Status: ${textContent.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`  Message: ${textContent.message}`);
    console.log(`  Viewport: ${textContent.viewport}`);
    console.log(`  Theme: ${textContent.theme}`);
    console.log(`  Timestamp: ${textContent.timestamp}`);
    console.log(`  Session ID: ${textContent.sessionId}`);

    if (textContent.session) {
      console.log('\nSession Created:');
      console.log(`  Player ID: ${textContent.session.playerId}`);
      console.log(`  Username: ${textContent.session.username}`);
      console.log(`  Email: ${textContent.session.email}`);
      console.log(`  Crit-Coins: ${textContent.session.critCoins}`);
      console.log(`  Has Token: ${textContent.session.hasToken ? 'Yes' : 'No'}`);
    }

    if (result.content[1] && result.content[1].type === 'image') {
      console.log('\n  Screenshot captured and returned in response');
      console.log(`  Screenshot size: ${result.content[1].data.length} bytes (base64)`);
    }
  },

  async cfgLogout(options = {}) {
    console.log('Running cfg-logout test...');

    const result = await callTool('cfg_logout', {
      viewport: options.viewport || 'desktop',
      sessionId: options.sessionId
    });

    const textContent = JSON.parse(result.content[0].text);
    console.log('\nLogout Test Result:');
    console.log(`  Status: ${textContent.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`  Message: ${textContent.message}`);
    console.log(`  Viewport: ${textContent.viewport}`);
    console.log(`  Session ID: ${textContent.sessionId}`);
    console.log(`  Username: ${textContent.username}`);
    console.log(`  Timestamp: ${textContent.timestamp}`);

    if (result.content[1] && result.content[1].type === 'image') {
      console.log('\n  Screenshot captured and returned in response');
      console.log(`  Screenshot size: ${result.content[1].data.length} bytes (base64)`);
    }
  },

  async sessionInfo(sessionId) {
    const result = await callTool('get_session_info', { sessionId });
    const info = JSON.parse(result.content[0].text);

    console.log('\nSession Info:');
    if (info.message) {
      console.log(`  ${info.message}`);
      console.log(`  Active Sessions: ${info.activeSessions}`);
      console.log(`  Total Sessions: ${info.totalSessions}`);
    } else {
      console.log(`  Session ID: ${info.sessionId}`);
      console.log(`  Player ID: ${info.playerId}`);
      console.log(`  Username: ${info.username}`);
      console.log(`  Email: ${info.email}`);
      console.log(`  Crit-Coins: ${info.critCoins}`);
      console.log(`  Story Credits: ${info.storyCredits}`);
      console.log(`  Created: ${new Date(info.createdAt).toLocaleString()}`);
      console.log(`  Last Used: ${new Date(info.lastUsedAt).toLocaleString()}`);
      console.log(`  Active: ${info.isActive ? 'Yes' : 'No'}`);
      console.log(`  Has Token: ${info.hasToken ? 'Yes' : 'No'}`);
    }
  },

  async listSessions(options = {}) {
    const result = await callTool('list_sessions', {
      includeInactive: options.includeInactive === 'true' || options.includeInactive === true
    });
    const data = JSON.parse(result.content[0].text);

    console.log(`\nSessions (${data.count} of ${data.totalSessions} total):\n`);

    if (data.sessions.length === 0) {
      console.log('  No sessions found');
    } else {
      data.sessions.forEach(session => {
        const status = session.isActive ? '✓ Active' : '✗ Inactive';
        console.log(`  ${session.sessionId} [${status}]`);
        console.log(`    Username: ${session.username}`);
        console.log(`    Email: ${session.email}`);
        console.log(`    Crit-Coins: ${session.critCoins}`);
        console.log(`    Created: ${new Date(session.createdAt).toLocaleString()}`);
        console.log('');
      });
    }
  },

  async cfgTap(testId, options = {}) {
    if (!testId) {
      throw new Error('Test ID required');
    }

    console.log(`Tapping element: ${testId}`);

    const result = await callTool('cfg_tap', {
      testId,
      sessionId: options.sessionId,
      viewport: options.viewport || 'desktop'
    });

    const textContent = JSON.parse(result.content[0].text);
    console.log('\nTap Result:');
    console.log(`  Status: ${textContent.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`  Message: ${textContent.message}`);
    console.log(`  Test ID: ${textContent.testId}`);
    console.log(`  Elements Found: ${textContent.elementCount}`);

    if (result.content[1] && result.content[1].type === 'image') {
      console.log(`\n  Screenshot size: ${result.content[1].data.length} bytes (base64)`);
    }

    if (textContent.elements && textContent.elements.length > 0) {
      console.log(`\n  Interactive Elements (${Math.min(10, textContent.elements.length)} of ${textContent.elements.length}):`);
      textContent.elements.slice(0, 10).forEach(el => {
        console.log(`    - ${el.testId} (${el.tagName}${el.type ? `[${el.type}]` : ''}): ${el.text.substring(0, 50)}`);
      });
    }
  },

  async cfgFill(testId, value, options = {}) {
    if (!testId || value === undefined) {
      throw new Error('Test ID and value required');
    }

    console.log(`Filling element: ${testId} with value`);

    const result = await callTool('cfg_fill', {
      testId,
      value,
      sessionId: options.sessionId,
      viewport: options.viewport || 'desktop'
    });

    const textContent = JSON.parse(result.content[0].text);
    console.log('\nFill Result:');
    console.log(`  Status: ${textContent.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`  Message: ${textContent.message}`);
    console.log(`  Test ID: ${textContent.testId}`);
    console.log(`  Value: ${textContent.value}`);
    console.log(`  Elements Found: ${textContent.elementCount}`);

    if (result.content[1] && result.content[1].type === 'image') {
      console.log(`\n  Screenshot size: ${result.content[1].data.length} bytes (base64)`);
    }
  },

  async cfgBatch(actionsJson, options = {}) {
    if (!actionsJson) {
      throw new Error('Actions JSON required');
    }

    let actions;
    try {
      actions = JSON.parse(actionsJson);
    } catch (e) {
      throw new Error('Invalid actions JSON format');
    }

    console.log(`Executing batch of ${actions.length} actions`);

    const result = await callTool('cfg_batch', {
      actions,
      sessionId: options.sessionId,
      viewport: options.viewport || 'desktop'
    });

    const textContent = JSON.parse(result.content[0].text);
    console.log('\nBatch Result:');
    console.log(`  Status: ${textContent.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`  Message: ${textContent.message}`);
    console.log(`  Actions Executed: ${textContent.actions.length}`);
    console.log(`  Elements Found: ${textContent.elementCount}`);

    textContent.actions.forEach(action => {
      console.log(`    ${action.index}. ${action.type} ${action.testId}`);
    });

    if (result.content[1] && result.content[1].type === 'image') {
      console.log(`\n  Screenshot size: ${result.content[1].data.length} bytes (base64)`);
    }
  }
};

/**
 * Main CLI
 */
async function main() {
  const [,, command, ...args] = process.argv;

  if (!command || command === 'help') {
    console.log('MCP Client CLI');
    console.log('\nUsage: node mcp-server/client.js <command> [options]');
    console.log('\nCommands:');
    console.log('  health                              Check MCP server health');
    console.log('  tools                               List available tools');
    console.log('  run <testFile> [--project=browser]  Run Playwright tests');
    console.log('  status <testId>                     Get test run status');
    console.log('  output <testId> [--tail=N]          Get test output logs');
    console.log('  list [--status=filter]              List test runs');
    console.log('  artifacts <testId>                  Get test artifacts');
    console.log('  cfgLogin [--viewport=desktop|mobile] [--theme=dark|light]');
    console.log('                                      Run login test and create session');
    console.log('  cfgLogout [--viewport=desktop|mobile] [--sessionId=id]');
    console.log('                                      Run logout test and invalidate session');
    console.log('  sessionInfo [sessionId]             Get info about a session');
    console.log('  listSessions [--includeInactive]    List all sessions');
    console.log('  cfgTap <testId> [--sessionId=id] [--viewport=desktop|mobile]');
    console.log('                                      Tap element by test ID');
    console.log('  cfgFill <testId> <value> [--sessionId=id] [--viewport=desktop|mobile]');
    console.log('                                      Fill input by test ID');
    console.log('  cfgBatch <actionsJson> [--sessionId=id] [--viewport=desktop|mobile]');
    console.log('                                      Execute batch of UI actions');
    console.log('\nExamples:');
    console.log('  node mcp-server/client.js run tests/integration/09-auth-debug.spec.ts');
    console.log('  node mcp-server/client.js status abc123def456');
    console.log('  node mcp-server/client.js list --status=running');
    console.log('  node mcp-server/client.js cfgLogin --viewport=mobile --theme=light');
    console.log('  node mcp-server/client.js cfgLogout --viewport=desktop --sessionId=abc123');
    console.log('  node mcp-server/client.js sessionInfo');
    console.log('  node mcp-server/client.js listSessions --includeInactive');
    console.log('  node mcp-server/client.js cfgTap discord-button');
    console.log('  node mcp-server/client.js cfgFill email-input user@example.com');
    console.log('  node mcp-server/client.js cfgBatch \'[{"type":"fill","testId":"username","value":"test"},{"type":"tap","testId":"submit"}]\'');
    return;
  }

  try {
    if (!commands[command]) {
      throw new Error(`Unknown command: ${command}`);
    }

    // Parse options
    const options = {};
    const positionalArgs = [];

    for (const arg of args) {
      if (arg.startsWith('--')) {
        const [key, value] = arg.substring(2).split('=');
        options[key] = value === undefined ? true : value;
      } else {
        positionalArgs.push(arg);
      }
    }

    await commands[command](...positionalArgs, options);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { mcpRequest, callTool, commands };
