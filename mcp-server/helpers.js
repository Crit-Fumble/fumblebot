/**
 * MCP Helper Functions for Claude Code
 *
 * These helper functions allow Claude Code to easily interact with the MCP server
 * to run tests in the background during development sessions.
 */

const http = require('http');

const MCP_HOST = process.env.MCP_HOST || 'localhost';
const MCP_PORT = process.env.MCP_PORT || 3333;

/**
 * Make HTTP request to MCP server
 */
function mcpRequest(path, method = 'POST', body = null) {
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
  const response = await mcpRequest('/mcp/tools/call', 'POST', {
    name,
    arguments: args
  });

  if (response.content && response.content[0]) {
    return JSON.parse(response.content[0].text);
  }

  return response;
}

/**
 * Helper: Run Playwright tests in background
 */
async function runTests(testFile = null, options = {}) {
  const result = await callTool('run_playwright_tests', {
    testFile,
    project: options.project || 'chromium',
    grep: options.grep,
    processCaptures: options.processCaptures !== false,
    timeout: options.timeout
  });

  console.log(`[MCP] Test started: ${result.testId}`);
  console.log(`[MCP] Status: ${result.status}`);

  return result.testId;
}

/**
 * Helper: Get test status
 */
async function getTestStatus(testId) {
  const status = await callTool('get_test_status', { testId });

  console.log(`[MCP] Test ${testId}:`);
  console.log(`  Status: ${status.status}`);
  console.log(`  Duration: ${Math.round(status.duration / 1000)}s`);

  if (status.status === 'passed' || status.status === 'failed') {
    console.log(`  Exit Code: ${status.exitCode}`);
    console.log(`  Screenshots: ${status.artifacts.screenshots.length}`);
    console.log(`  Videos: ${status.artifacts.videos.length}`);
  }

  return status;
}

/**
 * Helper: Get test output
 */
async function getTestOutput(testId, tail = null) {
  const result = await callTool('get_test_output', { testId, tail });
  return result;
}

/**
 * Helper: List test runs
 */
async function listTestRuns(statusFilter = null, limit = 20) {
  const runs = await callTool('list_test_runs', {
    status: statusFilter,
    limit
  });

  console.log(`[MCP] Found ${runs.length} test runs`);
  runs.forEach(run => {
    const duration = Math.round(run.duration / 1000);
    console.log(`  ${run.id}: ${run.status} (${duration}s)`);
  });

  return runs;
}

/**
 * Helper: Get test artifacts
 */
async function getTestArtifacts(testId) {
  const artifacts = await callTool('get_test_artifacts', { testId });

  console.log(`[MCP] Artifacts for ${testId}:`);
  console.log(`  Screenshots: ${artifacts.screenshots.length}`);
  console.log(`  Videos: ${artifacts.videos.length}`);
  console.log(`  Traces: ${artifacts.traces.length}`);

  return artifacts;
}

/**
 * Helper: Check MCP server health
 */
async function checkHealth() {
  try {
    const health = await mcpRequest('/health', 'GET');
    console.log(`[MCP] Server is ${health.status}`);
    console.log(`  Uptime: ${Math.round(health.uptime)}s`);
    console.log(`  Active tests: ${health.activeTests}`);
    console.log(`  Total tests: ${health.totalTests}`);
    return health;
  } catch (error) {
    console.error(`[MCP] Server is not responding: ${error.message}`);
    return null;
  }
}

/**
 * Helper: Run auth debug test
 */
async function runAuthDebugTest() {
  return runTests('tests/integration/09-auth-debug.spec.ts', {
    project: 'chromium'
  });
}

/**
 * Helper: Run login flow test
 */
async function runLoginFlowTest() {
  return runTests('tests/integration/08-user-login-flow.spec.ts', {
    project: 'chromium',
    timeout: 60000
  });
}

/**
 * Helper: Run all auth tests
 */
async function runAllAuthTests() {
  return runTests(null, {
    grep: 'auth',
    project: 'chromium'
  });
}

/**
 * Helper: Wait for test to complete and return result
 */
async function runTestAndWait(testFile, options = {}, checkInterval = 5000) {
  const testId = await runTests(testFile, options);

  console.log(`[MCP] Waiting for test ${testId} to complete...`);

  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      const status = await getTestStatus(testId);

      if (status.status === 'passed' || status.status === 'failed') {
        clearInterval(interval);
        console.log(`[MCP] Test completed: ${status.status}`);
        resolve(status);
      }
    }, checkInterval);
  });
}

module.exports = {
  // Low-level
  mcpRequest,
  callTool,

  // High-level helpers
  runTests,
  getTestStatus,
  getTestOutput,
  listTestRuns,
  getTestArtifacts,
  checkHealth,

  // Convenience helpers
  runAuthDebugTest,
  runLoginFlowTest,
  runAllAuthTests,
  runTestAndWait
};
