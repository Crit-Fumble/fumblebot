#!/usr/bin/env node

/**
 * MCP Server for Background Playwright Test Execution
 *
 * Provides a Model Context Protocol server that allows Claude Code to run
 * Playwright tests in the background while continuing development work.
 *
 * Features:
 * - Run tests asynchronously in Docker containers
 * - Monitor test execution status
 * - Retrieve test results and artifacts
 * - Queue management for concurrent test runs
 */

const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

const PORT = process.env.MCP_PORT || 3333;
const HOST = process.env.MCP_HOST || '0.0.0.0';

// In-memory test execution tracking
const testRuns = new Map();

// In-memory session management
const activeSessions = new Map(); // Map<sessionId, SessionData>

// Persistent browser sessions for continuous recording
const browserSessions = new Map(); // Map<sessionId, BrowserSession>

/**
 * Session data structure
 */
class SessionData {
  constructor(sessionToken, playerData) {
    this.sessionToken = sessionToken;
    this.playerId = playerData.playerId;
    this.username = playerData.username;
    this.email = playerData.email;
    this.critCoins = playerData.critCoins || 0;
    this.storyCredits = playerData.storyCredits || 0;
    this.createdAt = new Date();
    this.lastUsedAt = new Date();
    this.isActive = true;
  }

  toJSON() {
    return {
      playerId: this.playerId,
      username: this.username,
      email: this.email,
      critCoins: this.critCoins,
      storyCredits: this.storyCredits,
      createdAt: this.createdAt,
      lastUsedAt: this.lastUsedAt,
      isActive: this.isActive,
      hasToken: !!this.sessionToken
    };
  }

  markUsed() {
    this.lastUsedAt = new Date();
  }

  invalidate() {
    this.isActive = false;
    this.sessionToken = null;
  }
}

/**
 * Browser session for continuous recording
 */
class BrowserSession {
  constructor(sessionId, viewport = 'desktop') {
    this.sessionId = sessionId;
    this.viewport = viewport;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.recording = false;
    this.recordingStartTime = null;
    this.videoPath = null;
    this.screenshotsDir = null;
    this.actionsPerformed = [];
    this.createdAt = new Date();
    this.lastUsedAt = new Date();
  }

  async initialize(sessionToken) {
    const viewportSize = this.viewport === 'mobile'
      ? { width: 375, height: 667 }
      : { width: 1920, height: 1080 };

    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox']
    });

    const timestamp = Date.now();
    const videosDir = path.join(__dirname, '..', 'tests', 'videos', `session-${this.sessionId}-${timestamp}`);
    this.screenshotsDir = path.join(__dirname, '..', 'tests', 'screenshots', `session-${this.sessionId}-${timestamp}`);

    await fs.mkdir(videosDir, { recursive: true });
    await fs.mkdir(this.screenshotsDir, { recursive: true });

    this.context = await this.browser.newContext({
      viewport: viewportSize,
      recordVideo: {
        dir: videosDir,
        size: viewportSize
      }
    });

    // Set session cookie if provided
    if (sessionToken) {
      await this.context.addCookies([{
        name: 'next-auth.session-token',
        value: sessionToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax'
      }]);
    }

    this.page = await this.context.newPage();
    this.videoPath = await this.page.video()?.path();
    this.recording = true;
    this.recordingStartTime = new Date();

    console.log(`[BrowserSession] Initialized session ${this.sessionId} with recording`);
  }

  async navigate(url) {
    if (!this.page) throw new Error('Browser session not initialized');
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
    this.lastUsedAt = new Date();
    this.actionsPerformed.push({ type: 'navigate', url, timestamp: new Date() });
  }

  async click(testId) {
    if (!this.page) throw new Error('Browser session not initialized');
    const element = this.page.locator(`[data-testid="${testId}"]`);
    await element.waitFor({ state: 'visible', timeout: 10000 });

    // Get element position and move mouse to it for visual effect
    const box = await element.boundingBox();
    if (box) {
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      await this.page.mouse.move(centerX, centerY, { steps: 10 });
      await this.page.waitForTimeout(300); // Brief pause to show hover
    }

    await element.click();
    await this.page.waitForTimeout(1000);
    await this.page.waitForLoadState('networkidle');
    this.lastUsedAt = new Date();
    this.actionsPerformed.push({ type: 'click', testId, timestamp: new Date() });
  }

  async fill(testId, value) {
    if (!this.page) throw new Error('Browser session not initialized');
    const element = this.page.locator(`[data-testid="${testId}"]`);
    await element.waitFor({ state: 'visible', timeout: 10000 });
    await element.fill(value);
    await this.page.waitForTimeout(500);
    this.lastUsedAt = new Date();
    this.actionsPerformed.push({ type: 'fill', testId, value, timestamp: new Date() });
  }

  async screenshot(name) {
    if (!this.page) throw new Error('Browser session not initialized');
    const screenshotPath = path.join(this.screenshotsDir, `${name}.png`);
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
    this.actionsPerformed.push({ type: 'screenshot', name, path: screenshotPath, timestamp: new Date() });
    return screenshotPath;
  }

  async extractElements() {
    if (!this.page) throw new Error('Browser session not initialized');

    const elements = await this.page.evaluate(() => {
      const interactiveElements = [];
      const testIdElements = document.querySelectorAll('[data-testid]');

      testIdElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);

        if (rect.width > 0 && rect.height > 0 && styles.display !== 'none' && styles.visibility !== 'hidden') {
          interactiveElements.push({
            testId: el.getAttribute('data-testid'),
            tagName: el.tagName.toLowerCase(),
            type: el.type || null,
            text: el.textContent?.trim().substring(0, 100) || '',
            placeholder: el.placeholder || null,
            value: el.value || null,
            ariaLabel: el.getAttribute('aria-label') || null,
            role: el.getAttribute('role') || null,
            position: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            isInteractive: ['button', 'a', 'input', 'textarea', 'select'].includes(el.tagName.toLowerCase()) ||
                          el.onclick !== null ||
                          el.getAttribute('role') === 'button'
          });
        }
      });

      return interactiveElements;
    });

    return elements;
  }

  async stopRecording() {
    if (!this.page || !this.recording) {
      throw new Error('No recording in progress');
    }

    const finalScreenshot = await this.screenshot('final');

    await this.page.close();
    await this.context.close();
    await this.browser.close();

    this.recording = false;

    // Video should be saved at the path we got earlier
    const recordingDuration = Date.now() - this.recordingStartTime.getTime();

    console.log(`[BrowserSession] Stopped recording for session ${this.sessionId}`);
    console.log(`[BrowserSession] Duration: ${recordingDuration}ms, Actions: ${this.actionsPerformed.length}`);

    return {
      videoPath: this.videoPath,
      screenshotsDir: this.screenshotsDir,
      duration: recordingDuration,
      actions: this.actionsPerformed,
      finalScreenshot
    };
  }

  toJSON() {
    return {
      sessionId: this.sessionId,
      viewport: this.viewport,
      recording: this.recording,
      recordingStartTime: this.recordingStartTime,
      actionsPerformed: this.actionsPerformed.length,
      createdAt: this.createdAt,
      lastUsedAt: this.lastUsedAt
    };
  }
}

/**
 * Test run status tracking
 */
class TestRun {
  constructor(id, config) {
    this.id = id;
    this.config = config;
    this.status = 'queued';
    this.startTime = new Date();
    this.endTime = null;
    this.output = [];
    this.error = null;
    this.exitCode = null;
    this.process = null;
    this.artifacts = {
      screenshots: [],
      videos: [],
      traces: [],
      report: null
    };
  }

  addOutput(data) {
    this.output.push({
      timestamp: new Date(),
      data: data.toString()
    });
  }

  setError(error) {
    this.error = error;
    this.status = 'failed';
    this.endTime = new Date();
  }

  setCompleted(exitCode) {
    this.exitCode = exitCode;
    this.status = exitCode === 0 ? 'passed' : 'failed';
    this.endTime = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      status: this.status,
      config: this.config,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.endTime ? this.endTime - this.startTime : Date.now() - this.startTime,
      exitCode: this.exitCode,
      error: this.error,
      outputLines: this.output.length,
      artifacts: this.artifacts
    };
  }
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    activeTests: Array.from(testRuns.values()).filter(r => r.status === 'running').length,
    totalTests: testRuns.size
  });
});

/**
 * MCP Protocol: List available tools
 */
app.post('/mcp/tools/list', (req, res) => {
  res.json({
    tools: [
      {
        name: 'run_playwright_tests',
        description: 'Run Playwright integration tests in Docker container with enhanced capture',
        inputSchema: {
          type: 'object',
          properties: {
            testFile: {
              type: 'string',
              description: 'Path to test file (e.g., "tests/integration/09-auth-debug.spec.ts")',
              required: false
            },
            project: {
              type: 'string',
              enum: ['chromium', 'firefox', 'webkit'],
              description: 'Browser project to run tests in',
              default: 'chromium'
            },
            grep: {
              type: 'string',
              description: 'Filter tests by name pattern',
              required: false
            },
            processCaptures: {
              type: 'boolean',
              description: 'Enable automatic video/screenshot processing',
              default: true
            },
            timeout: {
              type: 'number',
              description: 'Test timeout in milliseconds',
              default: 60000
            }
          }
        }
      },
      {
        name: 'get_test_status',
        description: 'Get status of a running or completed test run',
        inputSchema: {
          type: 'object',
          properties: {
            testId: {
              type: 'string',
              description: 'Test run ID',
              required: true
            }
          }
        }
      },
      {
        name: 'get_test_output',
        description: 'Get output logs from a test run',
        inputSchema: {
          type: 'object',
          properties: {
            testId: {
              type: 'string',
              description: 'Test run ID',
              required: true
            },
            tail: {
              type: 'number',
              description: 'Return last N lines of output',
              required: false
            }
          }
        }
      },
      {
        name: 'list_test_runs',
        description: 'List all test runs with optional status filter',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['queued', 'running', 'passed', 'failed'],
              description: 'Filter by status',
              required: false
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results',
              default: 20
            }
          }
        }
      },
      {
        name: 'get_test_artifacts',
        description: 'Get list of artifacts (screenshots, videos) from a test run',
        inputSchema: {
          type: 'object',
          properties: {
            testId: {
              type: 'string',
              description: 'Test run ID',
              required: true
            }
          }
        }
      },
      {
        name: 'cfg_login',
        description: 'Run login integration test and return screenshot of the login UI',
        inputSchema: {
          type: 'object',
          properties: {
            viewport: {
              type: 'string',
              enum: ['desktop', 'mobile'],
              description: 'Viewport size for screenshot (desktop or mobile)',
              default: 'desktop'
            },
            theme: {
              type: 'string',
              enum: ['light', 'dark'],
              description: 'Theme mode for screenshot (light or dark)',
              default: 'dark'
            }
          }
        }
      },
      {
        name: 'cfg_logout',
        description: 'Run logout integration test and return screenshot of the logged-out state',
        inputSchema: {
          type: 'object',
          properties: {
            viewport: {
              type: 'string',
              enum: ['desktop', 'mobile'],
              description: 'Viewport size for screenshot (desktop or mobile)',
              default: 'desktop'
            },
            sessionId: {
              type: 'string',
              description: 'Session ID to logout (optional, uses most recent if not provided)',
              required: false
            }
          }
        }
      },
      {
        name: 'get_session_info',
        description: 'Get information about the current active session',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID (optional, returns most recent if not provided)',
              required: false
            }
          }
        }
      },
      {
        name: 'list_sessions',
        description: 'List all active sessions',
        inputSchema: {
          type: 'object',
          properties: {
            includeInactive: {
              type: 'boolean',
              description: 'Include invalidated sessions',
              default: false
            }
          }
        }
      },
      {
        name: 'cfg_tap',
        description: 'Tap/click an element by test ID and return screenshot with updated elements',
        inputSchema: {
          type: 'object',
          properties: {
            testId: {
              type: 'string',
              description: 'Test ID of element to tap (data-testid attribute)',
              required: true
            },
            sessionId: {
              type: 'string',
              description: 'Session ID for authenticated actions (optional, uses most recent)',
              required: false
            },
            viewport: {
              type: 'string',
              enum: ['desktop', 'mobile'],
              description: 'Viewport size',
              default: 'desktop'
            }
          }
        }
      },
      {
        name: 'cfg_fill',
        description: 'Fill an input field by test ID and return screenshot with updated elements',
        inputSchema: {
          type: 'object',
          properties: {
            testId: {
              type: 'string',
              description: 'Test ID of input element to fill',
              required: true
            },
            value: {
              type: 'string',
              description: 'Value to fill into the input',
              required: true
            },
            sessionId: {
              type: 'string',
              description: 'Session ID for authenticated actions (optional)',
              required: false
            },
            viewport: {
              type: 'string',
              enum: ['desktop', 'mobile'],
              description: 'Viewport size',
              default: 'desktop'
            }
          }
        }
      },
      {
        name: 'cfg_batch',
        description: 'Execute a batch of UI actions (tap, fill) in sequence',
        inputSchema: {
          type: 'object',
          properties: {
            actions: {
              type: 'array',
              description: 'Array of actions to execute: [{type: "tap|fill", testId: "...", value: "..."}]',
              required: true
            },
            sessionId: {
              type: 'string',
              description: 'Session ID for authenticated actions (optional)',
              required: false
            },
            viewport: {
              type: 'string',
              enum: ['desktop', 'mobile'],
              description: 'Viewport size',
              default: 'desktop'
            }
          }
        }
      },
      {
        name: 'start_recording',
        description: 'Start a continuous recording session with persistent browser context',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID for authenticated actions',
              required: true
            },
            viewport: {
              type: 'string',
              enum: ['desktop', 'mobile'],
              description: 'Viewport size',
              default: 'desktop'
            },
            startUrl: {
              type: 'string',
              description: 'Initial URL to navigate to',
              default: '/'
            }
          }
        }
      },
      {
        name: 'record_action',
        description: 'Perform an action (tap/fill/navigate) in the recording session',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID of the recording session',
              required: true
            },
            action: {
              type: 'object',
              description: 'Action to perform: {type: "tap|fill|navigate", testId?: "...", value?: "...", url?: "..."}',
              required: true
            },
            screenshot: {
              type: 'boolean',
              description: 'Take screenshot after action',
              default: true
            }
          }
        }
      },
      {
        name: 'stop_recording',
        description: 'Stop recording and return the video file with all screenshots',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID of the recording session',
              required: true
            }
          }
        }
      },
      {
        name: 'list_recordings',
        description: 'List all active recording sessions',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  });
});

/**
 * MCP Protocol: Execute tool
 */
app.post('/mcp/tools/call', async (req, res) => {
  const { name, arguments: args } = req.body;

  try {
    switch (name) {
      case 'run_playwright_tests':
        const result = await runPlaywrightTests(args);
        res.json({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
        break;

      case 'get_test_status':
        const status = getTestStatus(args.testId);
        res.json({ content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] });
        break;

      case 'get_test_output':
        const output = getTestOutput(args.testId, args.tail);
        res.json({ content: [{ type: 'text', text: output }] });
        break;

      case 'list_test_runs':
        const runs = listTestRuns(args.status, args.limit);
        res.json({ content: [{ type: 'text', text: JSON.stringify(runs, null, 2) }] });
        break;

      case 'get_test_artifacts':
        const artifacts = await getTestArtifacts(args.testId);
        res.json({ content: [{ type: 'text', text: JSON.stringify(artifacts, null, 2) }] });
        break;

      case 'cfg_login':
        const loginResult = await runCfgLogin(args);
        res.json({ content: loginResult });
        break;

      case 'cfg_logout':
        const logoutResult = await runCfgLogout(args);
        res.json({ content: logoutResult });
        break;

      case 'get_session_info':
        const sessionInfo = getSessionInfo(args.sessionId);
        res.json({ content: [{ type: 'text', text: JSON.stringify(sessionInfo, null, 2) }] });
        break;

      case 'list_sessions':
        const sessions = listSessions(args.includeInactive);
        res.json({ content: [{ type: 'text', text: JSON.stringify(sessions, null, 2) }] });
        break;

      case 'cfg_tap':
        const tapResult = await runCfgTap(args);
        res.json({ content: tapResult });
        break;

      case 'cfg_fill':
        const fillResult = await runCfgFill(args);
        res.json({ content: fillResult });
        break;

      case 'cfg_batch':
        const batchResult = await runCfgBatch(args);
        res.json({ content: batchResult });
        break;

      case 'start_recording':
        const startResult = await startRecording(args);
        res.json({ content: startResult });
        break;

      case 'record_action':
        const actionResult = await recordAction(args);
        res.json({ content: actionResult });
        break;

      case 'stop_recording':
        const stopResult = await stopRecording(args);
        res.json({ content: stopResult });
        break;

      case 'list_recordings':
        const recordings = listRecordings();
        res.json({ content: [{ type: 'text', text: JSON.stringify(recordings, null, 2) }] });
        break;

      default:
        res.status(404).json({ error: `Unknown tool: ${name}` });
    }
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Run Playwright tests in Docker container
 */
async function runPlaywrightTests(config) {
  const testId = crypto.randomBytes(8).toString('hex');
  const testRun = new TestRun(testId, config);
  testRuns.set(testId, testRun);

  console.log(`[${testId}] Starting test run:`, config);

  // Build docker-compose command
  const args = [
    'compose',
    '-f', 'docker-compose.test.yml',
    'run',
    '--rm',
    '-e', `PROCESS_CAPTURES=${config.processCaptures !== false}`,
    'test-capture',
    '/app/run-tests.sh'
  ];

  // Add test file if specified
  if (config.testFile) {
    args.push(config.testFile);
  }

  // Add project flag
  args.push('--project=' + (config.project || 'chromium'));

  // Add grep filter if specified
  if (config.grep) {
    args.push('--grep', config.grep);
  }

  // Add timeout if specified
  if (config.timeout) {
    args.push('--timeout=' + config.timeout);
  }

  // Spawn Docker process
  const dockerProcess = spawn('docker', args, {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL || 'http://host.docker.internal:3000'
    }
  });

  testRun.process = dockerProcess;
  testRun.status = 'running';

  // Capture output
  dockerProcess.stdout.on('data', (data) => {
    testRun.addOutput(data);
    console.log(`[${testId}] stdout:`, data.toString().trim());
  });

  dockerProcess.stderr.on('data', (data) => {
    testRun.addOutput(data);
    console.error(`[${testId}] stderr:`, data.toString().trim());
  });

  // Handle completion
  dockerProcess.on('close', async (code) => {
    console.log(`[${testId}] Process exited with code ${code}`);
    testRun.setCompleted(code);

    // Scan for artifacts
    try {
      await scanArtifacts(testRun);
    } catch (error) {
      console.error(`[${testId}] Error scanning artifacts:`, error);
    }
  });

  dockerProcess.on('error', (error) => {
    console.error(`[${testId}] Process error:`, error);
    testRun.setError(error.message);
  });

  return {
    testId,
    status: testRun.status,
    message: 'Test run started in background',
    config
  };
}

/**
 * Get test status
 */
function getTestStatus(testId) {
  const testRun = testRuns.get(testId);
  if (!testRun) {
    throw new Error(`Test run not found: ${testId}`);
  }
  return testRun.toJSON();
}

/**
 * Get test output
 */
function getTestOutput(testId, tail) {
  const testRun = testRuns.get(testId);
  if (!testRun) {
    throw new Error(`Test run not found: ${testId}`);
  }

  let output = testRun.output.map(o => `[${o.timestamp.toISOString()}] ${o.data}`).join('');

  if (tail && tail > 0) {
    const lines = output.split('\n');
    output = lines.slice(-tail).join('\n');
  }

  return output;
}

/**
 * List test runs
 */
function listTestRuns(statusFilter, limit = 20) {
  let runs = Array.from(testRuns.values());

  if (statusFilter) {
    runs = runs.filter(r => r.status === statusFilter);
  }

  // Sort by start time descending
  runs.sort((a, b) => b.startTime - a.startTime);

  // Apply limit
  runs = runs.slice(0, limit);

  return runs.map(r => r.toJSON());
}

/**
 * Scan for test artifacts
 */
async function scanArtifacts(testRun) {
  const baseDir = path.join(__dirname, '..');

  // Scan screenshots
  try {
    const screenshotDir = path.join(baseDir, 'tests', 'screenshots');
    const screenshots = await scanDirectory(screenshotDir, '.png');
    testRun.artifacts.screenshots = screenshots.filter(f => {
      // Filter by modification time - get files created after test started
      return f.mtime >= testRun.startTime;
    }).map(f => f.path);
  } catch (error) {
    console.error('Error scanning screenshots:', error);
  }

  // Scan videos
  try {
    const videoDir = path.join(baseDir, 'tests', 'videos');
    const videos = await scanDirectory(videoDir, ['.webm', '.mp4']);
    testRun.artifacts.videos = videos.filter(f => {
      return f.mtime >= testRun.startTime;
    }).map(f => f.path);
  } catch (error) {
    console.error('Error scanning videos:', error);
  }

  // Scan traces
  try {
    const traceDir = path.join(baseDir, 'tests', 'traces');
    const traces = await scanDirectory(traceDir, '.zip');
    testRun.artifacts.traces = traces.filter(f => {
      return f.mtime >= testRun.startTime;
    }).map(f => f.path);
  } catch (error) {
    console.error('Error scanning traces:', error);
  }

  // Check for HTML report
  try {
    const reportPath = path.join(baseDir, 'playwright-report', 'index.html');
    const stat = await fs.stat(reportPath);
    if (stat.mtime >= testRun.startTime) {
      testRun.artifacts.report = 'playwright-report/index.html';
    }
  } catch (error) {
    // Report doesn't exist or not accessible
  }
}

/**
 * Recursively scan directory for files with extensions
 */
async function scanDirectory(dir, extensions) {
  const results = [];
  const exts = Array.isArray(extensions) ? extensions : [extensions];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subResults = await scanDirectory(fullPath, extensions);
        results.push(...subResults);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (exts.includes(ext)) {
          const stat = await fs.stat(fullPath);
          results.push({
            path: fullPath,
            name: entry.name,
            size: stat.size,
            mtime: stat.mtime
          });
        }
      }
    }
  } catch (error) {
    // Directory doesn't exist or not accessible
  }

  return results;
}

/**
 * Get test artifacts
 */
async function getTestArtifacts(testId) {
  const testRun = testRuns.get(testId);
  if (!testRun) {
    throw new Error(`Test run not found: ${testId}`);
  }

  // Ensure artifacts are up to date
  if (testRun.status === 'passed' || testRun.status === 'failed') {
    await scanArtifacts(testRun);
  }

  return testRun.artifacts;
}

/**
 * Convert image file to base64
 */
async function imageToBase64(imagePath) {
  try {
    const imageBuffer = await fs.readFile(imagePath);
    return imageBuffer.toString('base64');
  } catch (error) {
    console.error(`Error reading image ${imagePath}:`, error);
    throw error;
  }
}

/**
 * Extract interactive elements from page with test IDs
 */
async function extractPageElements(screenshotDir, timestamp) {
  const elementsPath = path.join(screenshotDir, 'elements.json');

  try {
    const elementsContent = await fs.readFile(elementsPath, 'utf-8');
    const elements = JSON.parse(elementsContent);
    return elements;
  } catch (error) {
    console.error('Failed to read elements data:', error);
    return { elements: [], count: 0 };
  }
}

/**
 * Generate element extraction script
 */
function getElementExtractionScript(elementsPath) {
  return `
  // Extract all interactive elements with test IDs
  const elements = await page.evaluate(() => {
    const interactiveElements = [];

    // Find all elements with data-testid
    const testIdElements = document.querySelectorAll('[data-testid]');
    testIdElements.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      const styles = window.getComputedStyle(el);

      // Only include visible elements
      if (rect.width > 0 && rect.height > 0 && styles.display !== 'none' && styles.visibility !== 'hidden') {
        interactiveElements.push({
          testId: el.getAttribute('data-testid'),
          tagName: el.tagName.toLowerCase(),
          type: el.type || null,
          text: el.textContent?.trim().substring(0, 100) || '',
          placeholder: el.placeholder || null,
          value: el.value || null,
          ariaLabel: el.getAttribute('aria-label') || null,
          role: el.getAttribute('role') || null,
          position: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          isInteractive: ['button', 'a', 'input', 'textarea', 'select'].includes(el.tagName.toLowerCase()) ||
                        el.onclick !== null ||
                        el.getAttribute('role') === 'button'
        });
      }
    });

    return interactiveElements;
  });

  // Save elements data to file
  const { writeFileSync } = require('fs');
  writeFileSync('${elementsPath.replace(/\\/g, '\\\\')}', JSON.stringify({
    elements,
    count: elements.length,
    timestamp: Date.now()
  }, null, 2));

  console.log(\`Found \${elements.length} interactive elements with test IDs\`);
  `;
}

/**
 * Run cfg-login: Execute login test and return screenshot
 */
async function runCfgLogin(config) {
  const { viewport = 'desktop', theme = 'dark' } = config;
  const sessionId = crypto.randomBytes(8).toString('hex');

  console.log(`[cfg-login] Starting login test (viewport: ${viewport}, theme: ${theme}, sessionId: ${sessionId})`);

  // Run the static MCP login test
  const args = [
    'playwright',
    'test',
    'tests/mcp/login.spec.ts',
    '--project=chromium'
  ];

  try {
    await new Promise((resolve, reject) => {
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 'npx.cmd' : 'npx';
      const testProcess = spawn(command, args, {
        cwd: path.join(__dirname, '..'),
        env: {
          ...process.env,
          PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
          MCP_VIEWPORT: viewport,
          MCP_THEME: theme
        },
        shell: isWindows
      });

      let output = '';
      testProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        output += data.toString();
      });

      testProcess.on('close', (code) => {
        console.log(`[cfg-login] Test completed with code ${code}`);
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Test failed with code ${code}\n${output}`));
        }
      });

      testProcess.on('error', (error) => {
        reject(error);
      });
    });

    // Find the most recent mcp-login results directory
    const resultsBase = path.join(__dirname, '..', 'tests', 'results');
    const screenshotsBase = path.join(__dirname, '..', 'tests', 'screenshots');
    const videosBase = path.join(__dirname, '..', 'tests', 'videos');

    const resultsDirs = await fs.readdir(resultsBase);
    const mcpLoginDirs = resultsDirs.filter(d => d.startsWith('mcp-login-')).sort().reverse();

    if (mcpLoginDirs.length === 0) {
      throw new Error('No test results found');
    }

    const latestDir = mcpLoginDirs[0];
    const resultsDir = path.join(resultsBase, latestDir);
    const screenshotsDir = path.join(screenshotsBase, latestDir);
    const videosDir = path.join(videosBase, latestDir);

    // Read summary.json
    const summaryPath = path.join(resultsDir, 'summary.json');
    const summary = JSON.parse(await fs.readFile(summaryPath, 'utf-8'));

    // Read auth data
    const authDataPath = path.join(resultsDir, 'auth-data.json');
    const authData = JSON.parse(await fs.readFile(authDataPath, 'utf-8'));

    // Store session in memory
    const session = new SessionData(authData.sessionToken, {
      playerId: authData.playerId,
      username: authData.username,
      email: authData.email,
      critCoins: authData.critCoins || 0,
      storyCredits: authData.storyCredits || 0
    });

    activeSessions.set(sessionId, session);
    console.log(`[cfg-login] Session ${sessionId} created for user ${authData.username}`);

    // Read elements data (but only include top 10 interactive elements in response)
    const elementsPath = path.join(resultsDir, 'elements.json');
    const elementsData = JSON.parse(await fs.readFile(elementsPath, 'utf-8'));
    const interactiveElements = elementsData.elements
      .filter(el => el.isInteractive)
      .slice(0, 10);

    // Read final dashboard screenshot and convert to base64
    const dashboardScreenshotPath = path.join(screenshotsDir, '02-dashboard.png');
    const screenshotBase64 = await imageToBase64(dashboardScreenshotPath);

    // Construct response with embedded dashboard screenshot and top elements,
    // with links to all other resources
    return [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: 'Login test completed successfully',
          viewport,
          theme,
          timestamp: summary.timestamp,
          sessionId,
          session: {
            playerId: authData.playerId,
            username: authData.username,
            email: authData.email,
            role: authData.role,
            critCoins: authData.critCoins || 0,
            hasToken: true
          },
          interactive_elements: {
            top_10: interactiveElements,
            total_count: elementsData.elements.filter(el => el.isInteractive).length,
            all_elements_file: elementsPath
          },
          resources: {
            screenshots: {
              login: path.join(screenshotsDir, '01-login-page.png'),
              dashboard: path.join(screenshotsDir, '02-dashboard.png')
            },
            videos: {
              webm: path.join(videosDir, 'login-flow.webm'),
              mp4: path.join(videosDir, 'login-flow.mp4')
            },
            data: {
              auth: authDataPath,
              elements: elementsPath,
              summary: summaryPath
            }
          }
        }, null, 2)
      },
      {
        type: 'image',
        data: screenshotBase64,
        mimeType: 'image/png'
      }
    ];

  } catch (error) {
    console.error('[cfg-login] Error:', error);
    throw error;
  }
}

/**
 * Run cfg-logout: Execute logout test and return screenshot
 */
async function runCfgLogout(config) {
  const { viewport = 'desktop', sessionId } = config;
  const timestamp = Date.now();
  const screenshotDir = path.join(__dirname, '..', 'tests', 'screenshots', `cfg-logout-${timestamp}`);
  const screenshotPath = path.join(screenshotDir, 'logged-out.png');

  // Get session to logout
  let targetSessionId = sessionId;
  let session = null;

  if (targetSessionId) {
    session = activeSessions.get(targetSessionId);
    if (!session) {
      throw new Error(`Session ${targetSessionId} not found`);
    }
  } else {
    // Use most recent active session
    const sessions = Array.from(activeSessions.entries())
      .filter(([_, s]) => s.isActive)
      .sort((a, b) => b[1].createdAt - a[1].createdAt);

    if (sessions.length > 0) {
      [targetSessionId, session] = sessions[0];
    } else {
      throw new Error('No active sessions found. Please login first using cfg_login.');
    }
  }

  const sessionToken = session.sessionToken;
  console.log(`[cfg-logout] Starting logout test (viewport: ${viewport}, sessionId: ${targetSessionId})`);

  // Create test script that will use the existing session token
  const testScript = `
import { test, expect } from '@playwright/test';

test('cfg-logout screenshot', async ({ page, context }) => {
  // Set viewport based on config
  const viewportSize = '${viewport}' === 'mobile'
    ? { width: 375, height: 667 }
    : { width: 1920, height: 1080 };

  await page.setViewportSize(viewportSize);

  // Inject the session token as a cookie
  await context.addCookies([{
    name: 'authjs.session-token',
    value: '${sessionToken}',
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax'
  }]);

  // Navigate to dashboard to verify we're logged in
  await page.goto('/dashboard');
  await page.waitForTimeout(2000);

  const currentUrl = page.url();
  console.log('After session cookie injection, URL:', currentUrl);

  // Verify we're logged in (should be on dashboard)
  if (currentUrl.includes('/dashboard')) {
    console.log('✅ Session is valid, user is logged in');
  } else {
    console.log('⚠️ Session may have expired or is invalid');
  }

  // Now log out by clearing cookies
  await context.clearCookies();

  // Navigate to homepage which should redirect to login
  await page.goto('/');
  await page.waitForURL('/login', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Verify we're logged out (should see login page)
  await expect(page.getByRole('heading', { name: /Crit Fumble Gaming/i })).toBeVisible();

  // Take screenshot
  await page.screenshot({
    path: '${screenshotPath.replace(/\\/g, '\\\\')}',
    fullPage: true,
  });
});
`;

  // Write temporary test file
  const tempTestPath = path.join(__dirname, '..', 'tests', 'integration', `temp-cfg-logout-${timestamp}.spec.ts`);
  try {
    await fs.mkdir(screenshotDir, { recursive: true });
    await fs.writeFile(tempTestPath, testScript);

    // Run the test with npx playwright (use relative path from project root)
    const relativeTestPath = path.relative(path.join(__dirname, '..'), tempTestPath);
    const args = [
      'playwright',
      'test',
      relativeTestPath,
      '--project=chromium'
    ];

    await new Promise((resolve, reject) => {
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 'npx.cmd' : 'npx';
      const testProcess = spawn(command, args, {
        cwd: path.join(__dirname, '..'),
        env: {
          ...process.env,
          PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
        },
        shell: isWindows
      });

      let output = '';
      testProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        output += data.toString();
      });

      testProcess.on('close', (code) => {
        console.log(`[cfg-logout] Test completed with code ${code}`);
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Test failed with code ${code}\n${output}`));
        }
      });

      testProcess.on('error', (error) => {
        reject(error);
      });
    });

    // Read the screenshot and convert to base64
    const screenshotBase64 = await imageToBase64(screenshotPath);

    // Invalidate the session
    session.invalidate();
    console.log(`[cfg-logout] Session ${targetSessionId} invalidated`);

    return [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: 'Logout test completed successfully',
          viewport,
          timestamp,
          sessionId: targetSessionId,
          username: session.username
        }, null, 2)
      },
      {
        type: 'image',
        data: screenshotBase64,
        mimeType: 'image/png'
      }
    ];

  } catch (error) {
    console.error('[cfg-logout] Error:', error);
    throw error;
  } finally {
    // Clean up temp test file
    try {
      await fs.unlink(tempTestPath);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Run cfg-tap: Click an element by test ID
 */
async function runCfgTap(config) {
  const { testId, sessionId, viewport = 'desktop' } = config;
  const timestamp = Date.now();
  const screenshotDir = path.join(__dirname, '..', 'tests', 'screenshots', `cfg-tap-${timestamp}`);
  const screenshotPath = path.join(screenshotDir, 'after-tap.png');
  const elementsPath = path.join(screenshotDir, 'elements.json');

  // Get session token if needed
  let sessionToken = null;
  if (sessionId) {
    const session = activeSessions.get(sessionId);
    if (session && session.isActive) {
      sessionToken = session.sessionToken;
    }
  }

  console.log(`[cfg-tap] Tapping element: ${testId} (viewport: ${viewport}, sessionId: ${sessionId || 'none'})`);

  const testScript = `
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'fs';

test('cfg-tap action', async ({ page, context }) => {
  const viewportSize = '${viewport}' === 'mobile'
    ? { width: 375, height: 667 }
    : { width: 1920, height: 1080 };

  await page.setViewportSize(viewportSize);

  ${sessionToken ? `
  // Inject session token
  await context.addCookies([{
    name: 'authjs.session-token',
    value: '${sessionToken}',
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax'
  }]);
  ` : ''}

  // Navigate to current page or login
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Find and click the element
  const element = page.locator('[data-testid="${testId}"]');
  await expect(element).toBeVisible({ timeout: 10000 });
  await element.click();

  // Wait for any navigation or updates
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle');

  ${getElementExtractionScript(elementsPath)}

  // Take screenshot
  await page.screenshot({
    path: '${screenshotPath.replace(/\\/g, '\\\\')}',
    fullPage: true,
  });

  console.log('Tap action completed');
});
`;

  const tempTestPath = path.join(__dirname, '..', 'tests', 'integration', `temp-cfg-tap-${timestamp}.spec.ts`);
  try {
    await fs.mkdir(screenshotDir, { recursive: true });
    await fs.writeFile(tempTestPath, testScript);

    // Run the test with npx playwright (use relative path from project root)
    const relativeTestPath = path.relative(path.join(__dirname, '..'), tempTestPath);
    const args = [
      'playwright',
      'test',
      relativeTestPath,
      '--project=chromium'
    ];

    await new Promise((resolve, reject) => {
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 'npx.cmd' : 'npx';
      const testProcess = spawn(command, args, {
        cwd: path.join(__dirname, '..'),
        env: {
          ...process.env,
          PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
        },
        shell: isWindows
      });

      let output = '';
      testProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        output += data.toString();
      });

      testProcess.on('close', (code) => {
        console.log(`[cfg-tap] Test completed with code ${code}`);
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Test failed with code ${code}\n${output}`));
        }
      });

      testProcess.on('error', (error) => {
        reject(error);
      });
    });

    const screenshotBase64 = await imageToBase64(screenshotPath);
    const elementsData = await extractPageElements(screenshotDir, timestamp);

    return [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Tapped element: ${testId}`,
          testId,
          viewport,
          timestamp,
          elements: elementsData.elements,
          elementCount: elementsData.count
        }, null, 2)
      },
      {
        type: 'image',
        data: screenshotBase64,
        mimeType: 'image/png'
      }
    ];

  } catch (error) {
    console.error('[cfg-tap] Error:', error);
    throw error;
  } finally {
    try {
      await fs.unlink(tempTestPath);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Run cfg-fill: Fill an input by test ID
 */
async function runCfgFill(config) {
  const { testId, value, sessionId, viewport = 'desktop' } = config;
  const timestamp = Date.now();
  const screenshotDir = path.join(__dirname, '..', 'tests', 'screenshots', `cfg-fill-${timestamp}`);
  const screenshotPath = path.join(screenshotDir, 'after-fill.png');
  const elementsPath = path.join(screenshotDir, 'elements.json');

  // Get session token if needed
  let sessionToken = null;
  if (sessionId) {
    const session = activeSessions.get(sessionId);
    if (session && session.isActive) {
      sessionToken = session.sessionToken;
    }
  }

  console.log(`[cfg-fill] Filling element: ${testId} with value (viewport: ${viewport})`);

  const testScript = `
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'fs';

test('cfg-fill action', async ({ page, context }) => {
  const viewportSize = '${viewport}' === 'mobile'
    ? { width: 375, height: 667 }
    : { width: 1920, height: 1080 };

  await page.setViewportSize(viewportSize);

  ${sessionToken ? `
  // Inject session token
  await context.addCookies([{
    name: 'authjs.session-token',
    value: '${sessionToken}',
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax'
  }]);
  ` : ''}

  // Navigate to current page or login
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Find and fill the element
  const element = page.locator('[data-testid="${testId}"]');
  await expect(element).toBeVisible({ timeout: 10000 });
  await element.clear();
  await element.fill('${value.replace(/'/g, "\\'")}');

  // Wait for any updates
  await page.waitForTimeout(1000);

  ${getElementExtractionScript(elementsPath)}

  // Take screenshot
  await page.screenshot({
    path: '${screenshotPath.replace(/\\/g, '\\\\')}',
    fullPage: true,
  });

  console.log('Fill action completed');
});
`;

  const tempTestPath = path.join(__dirname, '..', 'tests', 'integration', `temp-cfg-fill-${timestamp}.spec.ts`);
  try {
    await fs.mkdir(screenshotDir, { recursive: true });
    await fs.writeFile(tempTestPath, testScript);

    const args = [
      'compose',
      '-f', 'docker-compose.test.yml',
      'run',
      '--rm',
      'test-capture',
      '/app/run-tests.sh',
      tempTestPath,
      '--project=chromium'
    ];

    await new Promise((resolve, reject) => {
      const testProcess = spawn('docker', args, {
        cwd: path.join(__dirname, '..'),
        env: {
          ...process.env,
          PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL || 'http://host.docker.internal:3000'
        }
      });

      let output = '';
      testProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        output += data.toString();
      });

      testProcess.on('close', (code) => {
        console.log(`[cfg-fill] Test completed with code ${code}`);
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Test failed with code ${code}\n${output}`));
        }
      });

      testProcess.on('error', (error) => {
        reject(error);
      });
    });

    const screenshotBase64 = await imageToBase64(screenshotPath);
    const elementsData = await extractPageElements(screenshotDir, timestamp);

    return [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Filled element: ${testId}`,
          testId,
          value,
          viewport,
          timestamp,
          elements: elementsData.elements,
          elementCount: elementsData.count
        }, null, 2)
      },
      {
        type: 'image',
        data: screenshotBase64,
        mimeType: 'image/png'
      }
    ];

  } catch (error) {
    console.error('[cfg-fill] Error:', error);
    throw error;
  } finally {
    try {
      await fs.unlink(tempTestPath);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Run cfg-batch: Execute multiple actions in sequence
 */
async function runCfgBatch(config) {
  const { actions, sessionId, viewport = 'desktop' } = config;
  const timestamp = Date.now();
  const screenshotDir = path.join(__dirname, '..', 'tests', 'screenshots', `cfg-batch-${timestamp}`);
  const screenshotPath = path.join(screenshotDir, 'final-state.png');
  const elementsPath = path.join(screenshotDir, 'elements.json');

  // Get session token if needed
  let sessionToken = null;
  if (sessionId) {
    const session = activeSessions.get(sessionId);
    if (session && session.isActive) {
      sessionToken = session.sessionToken;
    }
  }

  console.log(`[cfg-batch] Executing ${actions.length} actions (viewport: ${viewport})`);

  // Generate action script
  const actionScripts = actions.map((action, index) => {
    if (action.type === 'tap') {
      return `
  // Action ${index + 1}: Tap ${action.testId}
  console.log('Executing action ${index + 1}: tap ${action.testId}');
  const tapElement${index} = page.locator('[data-testid="${action.testId}"]');
  await expect(tapElement${index}).toBeVisible({ timeout: 10000 });
  await tapElement${index}.click();
  await page.waitForTimeout(1500);
  await page.waitForLoadState('networkidle');
      `;
    } else if (action.type === 'fill') {
      return `
  // Action ${index + 1}: Fill ${action.testId}
  console.log('Executing action ${index + 1}: fill ${action.testId}');
  const fillElement${index} = page.locator('[data-testid="${action.testId}"]');
  await expect(fillElement${index}).toBeVisible({ timeout: 10000 });
  await fillElement${index}.clear();
  await fillElement${index}.fill('${action.value?.replace(/'/g, "\\'")}');
  await page.waitForTimeout(500);
      `;
    }
    return '';
  }).join('\n');

  const testScript = `
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'fs';

test('cfg-batch actions', async ({ page, context }) => {
  const viewportSize = '${viewport}' === 'mobile'
    ? { width: 375, height: 667 }
    : { width: 1920, height: 1080 };

  await page.setViewportSize(viewportSize);

  ${sessionToken ? `
  // Inject session token
  await context.addCookies([{
    name: 'authjs.session-token',
    value: '${sessionToken}',
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax'
  }]);
  ` : ''}

  // Navigate to current page or login
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  ${actionScripts}

  ${getElementExtractionScript(elementsPath)}

  // Take final screenshot
  await page.screenshot({
    path: '${screenshotPath.replace(/\\/g, '\\\\')}',
    fullPage: true,
  });

  console.log('Batch actions completed');
});
`;

  const tempTestPath = path.join(__dirname, '..', 'tests', 'integration', `temp-cfg-batch-${timestamp}.spec.ts`);
  try {
    await fs.mkdir(screenshotDir, { recursive: true });
    await fs.writeFile(tempTestPath, testScript);

    const args = [
      'compose',
      '-f', 'docker-compose.test.yml',
      'run',
      '--rm',
      'test-capture',
      '/app/run-tests.sh',
      tempTestPath,
      '--project=chromium'
    ];

    await new Promise((resolve, reject) => {
      const testProcess = spawn('docker', args, {
        cwd: path.join(__dirname, '..'),
        env: {
          ...process.env,
          PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL || 'http://host.docker.internal:3000'
        }
      });

      let output = '';
      testProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        output += data.toString();
      });

      testProcess.on('close', (code) => {
        console.log(`[cfg-batch] Test completed with code ${code}`);
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Test failed with code ${code}\n${output}`));
        }
      });

      testProcess.on('error', (error) => {
        reject(error);
      });
    });

    const screenshotBase64 = await imageToBase64(screenshotPath);
    const elementsData = await extractPageElements(screenshotDir, timestamp);

    return [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Executed ${actions.length} actions`,
          actions: actions.map((a, i) => ({ index: i + 1, type: a.type, testId: a.testId })),
          viewport,
          timestamp,
          elements: elementsData.elements,
          elementCount: elementsData.count
        }, null, 2)
      },
      {
        type: 'image',
        data: screenshotBase64,
        mimeType: 'image/png'
      }
    ];

  } catch (error) {
    console.error('[cfg-batch] Error:', error);
    throw error;
  } finally {
    try {
      await fs.unlink(tempTestPath);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Get session information
 */
function getSessionInfo(sessionId) {
  let targetSessionId = sessionId;
  let session = null;

  if (targetSessionId) {
    session = activeSessions.get(targetSessionId);
    if (!session) {
      throw new Error(`Session ${targetSessionId} not found`);
    }
  } else {
    // Return most recent active session
    const sessions = Array.from(activeSessions.entries())
      .filter(([_, s]) => s.isActive)
      .sort((a, b) => b[1].createdAt - a[1].createdAt);

    if (sessions.length > 0) {
      [targetSessionId, session] = sessions[0];
    } else {
      return {
        message: 'No active sessions found',
        activeSessions: 0,
        totalSessions: activeSessions.size
      };
    }
  }

  return {
    sessionId: targetSessionId,
    ...session.toJSON()
  };
}

/**
 * List all sessions
 */
function listSessions(includeInactive = false) {
  let sessions = Array.from(activeSessions.entries());

  if (!includeInactive) {
    sessions = sessions.filter(([_, s]) => s.isActive);
  }

  // Sort by creation time descending
  sessions.sort((a, b) => b[1].createdAt - a[1].createdAt);

  return {
    count: sessions.length,
    totalSessions: activeSessions.size,
    sessions: sessions.map(([id, session]) => ({
      sessionId: id,
      ...session.toJSON()
    }))
  };
}

/**
 * Start server
 */
app.listen(PORT, HOST, () => {
  console.log(`MCP Server listening on ${HOST}:${PORT}`);
  console.log('Available tools:');
  console.log('  - run_playwright_tests: Run tests in background');
  console.log('  - get_test_status: Get test run status');
  console.log('  - get_test_output: Get test output logs');
  console.log('  - list_test_runs: List all test runs');
  console.log('  - get_test_artifacts: Get test artifacts');
  console.log('  - cfg_login: Login test with screenshot, session, and elements');
  console.log('  - cfg_logout: Logout test with screenshot');
  console.log('  - cfg_tap: Tap element by test ID');
  console.log('  - cfg_fill: Fill input by test ID');
  console.log('  - cfg_batch: Execute batch of UI actions');
  console.log('  - start_recording: Start continuous video recording');
  console.log('  - record_action: Perform action during recording');
  console.log('  - stop_recording: Stop recording and get video');
  console.log('  - list_recordings: List active recordings');
  console.log('  - get_session_info: Get current session info');
  console.log('  - list_sessions: List all sessions');
});

/**
 * Start a continuous recording session
 */
async function startRecording(config) {
  const { sessionId, viewport = 'desktop', startUrl = '/' } = config;

  // Get the session token
  const session = activeSessions.get(sessionId);
  if (!session || !session.isActive) {
    throw new Error(`Session ${sessionId} not found or inactive`);
  }

  // Check if already recording
  if (browserSessions.has(sessionId)) {
    throw new Error(`Recording already active for session ${sessionId}`);
  }

  console.log(`[start_recording] Starting recording for session ${sessionId}`);

  // Create and initialize browser session
  const browserSession = new BrowserSession(sessionId, viewport);
  await browserSession.initialize(session.sessionToken);

  // Navigate to start URL
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  await browserSession.navigate(baseUrl + startUrl);

  // Take initial screenshot
  const initialScreenshot = await browserSession.screenshot('00-initial');

  // Extract initial elements
  const elements = await browserSession.extractElements();

  // Store the browser session
  browserSessions.set(sessionId, browserSession);

  // Read the screenshot
  const screenshotBase64 = await imageToBase64(initialScreenshot);

  return [
    {
      type: 'text',
      text: JSON.stringify({
        success: true,
        message: `Recording started for session ${sessionId}`,
        sessionId,
        viewport,
        startUrl,
        recordingStartTime: browserSession.recordingStartTime,
        screenshotsDir: browserSession.screenshotsDir,
        interactiveElements: elements.filter(e => e.isInteractive).slice(0, 10),
        totalElements: elements.length
      }, null, 2)
    },
    {
      type: 'image',
      data: screenshotBase64,
      mimeType: 'image/png'
    }
  ];
}

/**
 * Perform an action in the recording session
 */
async function recordAction(config) {
  const { sessionId, action, screenshot = true } = config;

  const browserSession = browserSessions.get(sessionId);
  if (!browserSession) {
    throw new Error(`No recording session found for ${sessionId}`);
  }

  console.log(`[record_action] Performing ${action.type} action for session ${sessionId}`);

  // Perform the action
  switch (action.type) {
    case 'tap':
    case 'click':
      await browserSession.click(action.testId);
      break;
    case 'fill':
      await browserSession.fill(action.testId, action.value);
      break;
    case 'navigate':
      const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
      await browserSession.navigate(baseUrl + action.url);
      break;
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }

  // Take screenshot if requested
  let screenshotPath = null;
  let screenshotBase64 = null;
  if (screenshot) {
    const actionCount = browserSession.actionsPerformed.length;
    const screenshotName = `${String(actionCount).padStart(2, '0')}-${action.type}-${action.testId || action.url || 'action'}`;
    screenshotPath = await browserSession.screenshot(screenshotName);
    screenshotBase64 = await imageToBase64(screenshotPath);
  }

  // Extract elements
  const elements = await browserSession.extractElements();

  const response = [
    {
      type: 'text',
      text: JSON.stringify({
        success: true,
        message: `Action ${action.type} completed`,
        sessionId,
        action,
        actionsPerformed: browserSession.actionsPerformed.length,
        interactiveElements: elements.filter(e => e.isInteractive).slice(0, 10),
        totalElements: elements.length,
        screenshotPath
      }, null, 2)
    }
  ];

  if (screenshotBase64) {
    response.push({
      type: 'image',
      data: screenshotBase64,
      mimeType: 'image/png'
    });
  }

  return response;
}

/**
 * Stop recording and return video
 */
async function stopRecording(config) {
  const { sessionId } = config;

  const browserSession = browserSessions.get(sessionId);
  if (!browserSession) {
    throw new Error(`No recording session found for ${sessionId}`);
  }

  console.log(`[stop_recording] Stopping recording for session ${sessionId}`);

  const result = await browserSession.stopRecording();

  // Remove from active sessions
  browserSessions.delete(sessionId);

  // Wait for video to be fully written
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Convert to MP4 if ffmpeg available
  let mp4Path = null;
  if (result.videoPath) {
    const { execSync } = require('child_process');
    const ffmpegPath = path.join(__dirname, '..', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
    if (require('fs').existsSync(ffmpegPath)) {
      try {
        mp4Path = result.videoPath.replace('.webm', '.mp4');
        execSync(`"${ffmpegPath}" -i "${result.videoPath}" -c:v libx264 -crf 23 -preset fast -c:a aac -b:a 128k "${mp4Path}" -y`, {
          stdio: 'ignore'
        });
        console.log(`[stop_recording] Converted video to MP4: ${mp4Path}`);
      } catch (err) {
        console.error(`[stop_recording] Failed to convert video:`, err);
      }
    }
  }

  // Read final screenshot
  const finalScreenshotBase64 = await imageToBase64(result.finalScreenshot);

  return [
    {
      type: 'text',
      text: JSON.stringify({
        success: true,
        message: `Recording stopped for session ${sessionId}`,
        sessionId,
        duration: result.duration,
        actionsPerformed: result.actions.length,
        videoPath: result.videoPath,
        mp4Path,
        screenshotsDir: result.screenshotsDir,
        finalScreenshot: result.finalScreenshot,
        actions: result.actions
      }, null, 2)
    },
    {
      type: 'image',
      data: finalScreenshotBase64,
      mimeType: 'image/png'
    }
  ];
}

/**
 * List all active recording sessions
 */
function listRecordings() {
  const recordings = [];
  for (const [sessionId, browserSession] of browserSessions.entries()) {
    recordings.push(browserSession.toJSON());
  }
  return {
    active: recordings.length,
    sessions: recordings
  };
}

/**
 * Graceful shutdown
 */
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');

  // Stop all browser sessions
  for (const [sessionId, browserSession] of browserSessions.entries()) {
    try {
      console.log(`Stopping recording for session ${sessionId}`);
      await browserSession.stopRecording();
    } catch (err) {
      console.error(`Failed to stop recording for ${sessionId}:`, err);
    }
  }

  // Kill all running test processes
  for (const [id, testRun] of testRuns.entries()) {
    if (testRun.process && testRun.status === 'running') {
      console.log(`Killing test run ${id}`);
      testRun.process.kill('SIGTERM');
    }
  }

  process.exit(0);
});
