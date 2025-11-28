/**
 * Discord Activity Server
 * Serves embedded applications that run within Discord
 *
 * Discord Activities are web apps that appear in an iframe within Discord.
 * They support voice, screen sharing, and rich interactions.
 */

import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ActivityServerConfig {
  port: number;
  host?: string;
  publicUrl: string; // e.g., https://fumblebot.crit-fumble.com
}

export class ActivityServer {
  private app: express.Application;
  private server: any;
  private config: ActivityServerConfig;

  constructor(config: ActivityServerConfig) {
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware() {
    // Parse JSON bodies
    this.app.use(express.json());

    // Serve static files from public directory
    // TODO: Create actual frontend app
    // this.app.use(express.static(path.join(__dirname, '../../../public/activity')));

    // CORS for Discord iframe
    // Discord Activities are served from *.discordsays.com
    const DISCORD_CLIENT_ID = process.env.FUMBLEBOT_DISCORD_CLIENT_ID || '1443525084256931880';
    const allowedOrigins = [
      'https://discord.com',
      `https://${DISCORD_CLIENT_ID}.discordsays.com`,
      'https://discordsays.com',
    ];

    this.app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (origin && allowedOrigins.some(allowed => origin.startsWith(allowed.replace('https://', 'https://')) || origin === allowed)) {
        res.header('Access-Control-Allow-Origin', origin);
      } else {
        // Default to discord.com for non-matching origins
        res.header('Access-Control-Allow-Origin', 'https://discord.com');
      }
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.header('Access-Control-Allow-Credentials', 'true');

      // Handle preflight
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    // Security headers for iframe embedding
    // Discord Activities run in iframes from *.discordsays.com
    this.app.use((req, res, next) => {
      // X-Frame-Options is deprecated for multiple origins, use CSP instead
      // But some browsers still need it, so we set it to SAMEORIGIN as fallback
      res.header('X-Frame-Options', 'SAMEORIGIN');
      // Content-Security-Policy frame-ancestors allows multiple origins
      res.header(
        'Content-Security-Policy',
        `frame-ancestors 'self' https://discord.com https://${DISCORD_CLIENT_ID}.discordsays.com https://*.discordsays.com`
      );
      next();
    });
  }

  /**
   * Setup Express routes
   */
  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Main activity route
    this.app.get('/discord/activity', (req, res) => {
      this.serveActivity(req, res);
    });

    // Activity API endpoints
    this.app.post('/discord/activity/api/session', (req, res) => {
      this.handleSessionCreate(req, res);
    });

    this.app.get('/discord/activity/api/session/:sessionId', (req, res) => {
      this.handleSessionGet(req, res);
    });

    // Character sheet viewer
    this.app.get('/discord/activity/character/:characterId', (req, res) => {
      this.serveCharacterSheet(req, res);
    });

    // Dice roller activity
    this.app.get('/discord/activity/dice', (req, res) => {
      this.serveDiceRoller(req, res);
    });

    // Map viewer activity
    this.app.get('/discord/activity/map', (req, res) => {
      this.serveMapViewer(req, res);
    });

    // Initiative tracker activity
    this.app.get('/discord/activity/initiative', (req, res) => {
      this.serveInitiativeTracker(req, res);
    });

    // Spell lookup activity
    this.app.get('/discord/activity/spells', (req, res) => {
      this.serveSpellLookup(req, res);
    });

    // OAuth2 token exchange for Discord Activity SDK
    this.app.post('/discord/activity/api/token', (req, res) => {
      this.handleTokenExchange(req, res);
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  /**
   * Serve main activity landing page with Discord SDK integration
   */
  private serveActivity(req: Request, res: Response) {
    const clientId = process.env.FUMBLEBOT_DISCORD_CLIENT_ID;

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FumbleBot Activity</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background: #2b2d31;
      color: #ffffff;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      max-width: 600px;
      padding: 40px 20px;
    }
    h1 {
      font-size: 48px;
      margin: 0 0 20px 0;
    }
    .status {
      padding: 20px;
      background: #383a40;
      border-radius: 8px;
      margin: 20px 0;
      font-size: 16px;
    }
    .status.loading { color: #b5bac1; }
    .status.success { background: #248046; }
    .status.error { background: #da373c; }
    .status.coming-soon { background: #5865f2; }
    .user-info {
      margin-top: 30px;
      padding: 20px;
      background: #383a40;
      border-radius: 8px;
      text-align: left;
    }
    .user-info p {
      margin: 8px 0;
      font-size: 14px;
    }
    .user-info strong {
      color: #b5bac1;
    }
    .admin-content {
      margin-top: 30px;
    }
    .admin-content h2 {
      font-size: 24px;
      margin-bottom: 10px;
    }
    .admin-content p {
      color: #b5bac1;
      font-size: 14px;
    }
    .coming-soon-box {
      display: none;
      margin-top: 30px;
      padding: 40px;
      background: linear-gradient(135deg, #5865f2 0%, #eb459e 100%);
      border-radius: 12px;
    }
    .coming-soon-box h2 {
      font-size: 32px;
      margin: 0 0 10px 0;
    }
    .coming-soon-box p {
      font-size: 18px;
      margin: 0;
      opacity: 0.9;
    }
    .debug-info {
      margin-top: 20px;
      padding: 15px;
      background: #1e1f22;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      text-align: left;
      max-height: 200px;
      overflow-y: auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>FumbleBot</h1>
    <div id="status" class="status loading">Initializing Discord Activity...</div>
    <div id="user-info" class="user-info" style="display:none;"></div>
    <div id="admin-content" class="admin-content" style="display:none;">
      <h2>Hello World!</h2>
      <p>Discord Activity is working. You have administrator access.</p>
    </div>
    <div id="coming-soon" class="coming-soon-box">
      <h2>Coming March 2026</h2>
      <p>FumbleBot Activities are currently in development.</p>
    </div>
    <div id="debug" class="debug-info" style="display:none;"></div>
  </div>

  <script type="module">
    import { DiscordSDK } from 'https://esm.sh/@discord/embedded-app-sdk@2.4.0';

    const CLIENT_ID = '${clientId}';
    const ADMINISTRATOR = 0x8n; // Administrator permission bit

    const statusEl = document.getElementById('status');
    const userInfoEl = document.getElementById('user-info');
    const adminContentEl = document.getElementById('admin-content');
    const comingSoonEl = document.getElementById('coming-soon');
    const debugEl = document.getElementById('debug');

    // Enable debug mode with ?debug=1
    const urlParams = new URLSearchParams(window.location.search);
    const debugMode = urlParams.get('debug') === '1';
    if (debugMode) debugEl.style.display = 'block';

    function log(msg) {
      console.log('[FumbleBot]', msg);
      if (debugMode) {
        debugEl.innerHTML += msg + '<br>';
        debugEl.scrollTop = debugEl.scrollHeight;
      }
    }

    function setStatus(message, type = 'loading') {
      statusEl.textContent = message;
      statusEl.className = 'status ' + type;
    }

    async function main() {
      try {
        // Step 1: Initialize the SDK
        log('Initializing Discord SDK...');
        setStatus('Connecting to Discord...');
        const discordSdk = new DiscordSDK(CLIENT_ID);

        // Step 2: Wait for SDK to be ready
        log('Waiting for SDK ready...');
        await discordSdk.ready();
        log('SDK ready! Instance ID: ' + discordSdk.instanceId);

        // Step 3: Authorize with Discord
        log('Requesting authorization...');
        setStatus('Authorizing...');
        const { code } = await discordSdk.commands.authorize({
          client_id: CLIENT_ID,
          response_type: 'code',
          state: '',
          prompt: 'none',
          scope: ['identify', 'guilds.members.read'],
        });
        log('Got authorization code');

        // Step 4: Exchange code for access token
        log('Exchanging token...');
        setStatus('Authenticating...');
        const tokenResponse = await fetch('/.proxy/discord/activity/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        if (!tokenResponse.ok) {
          const err = await tokenResponse.text();
          throw new Error('Token exchange failed: ' + err);
        }

        const { access_token } = await tokenResponse.json();
        log('Got access token');

        // Step 5: Authenticate with the SDK
        log('Authenticating with SDK...');
        const auth = await discordSdk.commands.authenticate({ access_token });
        log('Authenticated as: ' + auth.user.username);

        // Step 6: Check permissions
        log('Checking permissions...');
        setStatus('Checking permissions...');
        const { permissions } = await discordSdk.commands.getChannelPermissions();
        const permBigInt = BigInt(permissions);
        log('Permissions: ' + permissions);

        // Check for ADMINISTRATOR permission
        const isAdmin = (permBigInt & ADMINISTRATOR) === ADMINISTRATOR;
        log('Is admin: ' + isAdmin);

        if (!isAdmin) {
          // Show coming soon message for non-admins
          setStatus('FumbleBot Activities', 'coming-soon');
          comingSoonEl.style.display = 'block';
          return;
        }

        // Step 7: Success! Show admin content
        setStatus('Welcome, Administrator!', 'success');
        userInfoEl.style.display = 'block';
        userInfoEl.innerHTML =
          '<p><strong>User:</strong> ' + auth.user.username + '</p>' +
          '<p><strong>User ID:</strong> ' + auth.user.id + '</p>' +
          '<p><strong>Guild ID:</strong> ' + (discordSdk.guildId || 'N/A') + '</p>' +
          '<p><strong>Channel ID:</strong> ' + (discordSdk.channelId || 'N/A') + '</p>' +
          '<p><strong>Instance ID:</strong> ' + discordSdk.instanceId + '</p>';
        adminContentEl.style.display = 'block';

      } catch (error) {
        console.error('Activity initialization failed:', error);
        log('ERROR: ' + error.message);
        setStatus('Error: ' + error.message, 'error');
      }
    }

    main();
  </script>
</body>
</html>
    `);
  }

  /**
   * Serve character sheet viewer
   */
  private serveCharacterSheet(req: Request, res: Response) {
    const characterId = req.params.characterId;

    // TODO: Fetch character from database
    // TODO: Serve actual character sheet app

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Character Sheet</title>
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #2b2d31; color: #fff; }
    .header { text-align: center; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📜 Character Sheet</h1>
    <p>Character ID: ${characterId}</p>
    <p><em>Character sheet viewer coming soon...</em></p>
  </div>
</body>
</html>
    `);
  }

  /**
   * Serve dice roller activity
   */
  private serveDiceRoller(req: Request, res: Response) {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dice Roller</title>
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #2b2d31; color: #fff; }
    .dice-container { max-width: 600px; margin: 0 auto; text-align: center; }
    h1 { margin-bottom: 30px; }
    .dice-buttons { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
    button { padding: 15px; font-size: 18px; background: #5865f2; color: white; border: none; border-radius: 5px; cursor: pointer; }
    button:hover { background: #4752c4; }
    .result { font-size: 48px; margin: 30px 0; min-height: 60px; }
    .history { text-align: left; max-height: 200px; overflow-y: auto; }
    .history-item { padding: 5px; border-bottom: 1px solid #383a40; }
  </style>
</head>
<body>
  <div class="dice-container">
    <h1>🎲 Dice Roller</h1>
    <div class="dice-buttons">
      <button onclick="roll(4)">d4</button>
      <button onclick="roll(6)">d6</button>
      <button onclick="roll(8)">d8</button>
      <button onclick="roll(10)">d10</button>
      <button onclick="roll(12)">d12</button>
      <button onclick="roll(20)">d20</button>
      <button onclick="roll(100)">d100</button>
    </div>
    <div class="result" id="result">Roll a die!</div>
    <div class="history" id="history"></div>
  </div>

  <script>
    function roll(sides) {
      const result = Math.floor(Math.random() * sides) + 1;
      document.getElementById('result').textContent = result;

      const history = document.getElementById('history');
      const item = document.createElement('div');
      item.className = 'history-item';
      item.textContent = \`d\${sides}: \${result}\`;
      history.insertBefore(item, history.firstChild);

      // TODO: Send to Discord Activity SDK
      // window.parent.postMessage({ type: 'DICE_ROLL', sides, result }, 'https://discord.com');
    }
  </script>
</body>
</html>
    `);
  }

  /**
   * Serve map viewer activity
   */
  private serveMapViewer(req: Request, res: Response) {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Map Viewer</title>
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #2b2d31; color: #fff; }
  </style>
</head>
<body>
  <h1>🗺️ Map Viewer</h1>
  <p><em>Interactive map viewer coming soon...</em></p>
</body>
</html>
    `);
  }

  /**
   * Serve initiative tracker activity
   */
  private serveInitiativeTracker(req: Request, res: Response) {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Initiative Tracker</title>
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #2b2d31; color: #fff; }
  </style>
</head>
<body>
  <h1>⚔️ Initiative Tracker</h1>
  <p><em>Combat initiative tracker coming soon...</em></p>
</body>
</html>
    `);
  }

  /**
   * Serve spell lookup activity
   */
  private serveSpellLookup(req: Request, res: Response) {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Spell Lookup</title>
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #2b2d31; color: #fff; }
  </style>
</head>
<body>
  <h1>✨ Spell Lookup</h1>
  <p><em>Spell reference tool coming soon...</em></p>
</body>
</html>
    `);
  }

  /**
   * Handle session creation
   */
  private async handleSessionCreate(req: Request, res: Response) {
    const { channelId, guildId, userId } = req.body;

    // TODO: Create session in database
    const sessionId = `session-${Date.now()}`;

    res.json({
      sessionId,
      channelId,
      guildId,
      userId,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Handle session retrieval
   */
  private async handleSessionGet(req: Request, res: Response) {
    const { sessionId } = req.params;

    // TODO: Fetch session from database

    res.json({
      sessionId,
      status: 'active',
      participants: [],
    });
  }

  /**
   * Handle OAuth2 token exchange for Discord Activity SDK
   * The Activity frontend sends the authorization code, we exchange it for an access_token
   */
  private async handleTokenExchange(req: Request, res: Response) {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({ error: 'Missing authorization code' });
      return;
    }

    try {
      const response = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.FUMBLEBOT_DISCORD_CLIENT_ID!,
          client_secret: process.env.FUMBLEBOT_DISCORD_CLIENT_SECRET!,
          grant_type: 'authorization_code',
          code,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Activity] Token exchange failed:', errorText);
        res.status(400).json({ error: 'Token exchange failed' });
        return;
      }

      const tokenData = await response.json();
      res.json({ access_token: tokenData.access_token });
    } catch (error) {
      console.error('[Activity] Token exchange error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Start the activity server
   */
  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, this.config.host || '0.0.0.0', () => {
        console.log(`[Activity] Server running on ${this.config.publicUrl}`);
        console.log(`[Activity] Local: http://localhost:${this.config.port}/discord/activity`);
        resolve();
      });
    });
  }

  /**
   * Stop the activity server
   */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err: Error) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
