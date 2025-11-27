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
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', 'https://discord.com');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.header('Access-Control-Allow-Credentials', 'true');
      next();
    });

    // Security headers for iframe embedding
    this.app.use((req, res, next) => {
      res.header('X-Frame-Options', 'ALLOW-FROM https://discord.com');
      res.header('Content-Security-Policy', "frame-ancestors 'self' https://discord.com");
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

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  /**
   * Serve main activity landing page
   */
  private serveActivity(req: Request, res: Response) {
    // TODO: Serve actual React/Vue app
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FumbleBot Activity</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background: #2b2d31;
      color: #ffffff;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .header h1 {
      font-size: 32px;
      margin: 0 0 10px 0;
    }
    .header p {
      color: #b5bac1;
      margin: 0;
    }
    .activities {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }
    .activity-card {
      background: #383a40;
      border-radius: 8px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
      color: inherit;
      display: block;
    }
    .activity-card:hover {
      background: #404249;
      transform: translateY(-2px);
    }
    .activity-icon {
      font-size: 48px;
      margin-bottom: 10px;
    }
    .activity-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 5px;
    }
    .activity-description {
      font-size: 14px;
      color: #b5bac1;
    }
    .badge {
      display: inline-block;
      background: #5865f2;
      color: white;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎲 FumbleBot Activities</h1>
      <p>Interactive TTRPG tools for your Discord server</p>
    </div>

    <div class="activities">
      <a href="/discord/activity/dice" class="activity-card">
        <div class="activity-icon">🎲</div>
        <div class="activity-title">Dice Roller</div>
        <div class="activity-description">Roll dice with your party in real-time</div>
      </a>

      <a href="/discord/activity/initiative" class="activity-card">
        <div class="activity-icon">⚔️</div>
        <div class="activity-title">Initiative Tracker</div>
        <div class="activity-description">Track turn order during combat</div>
      </a>

      <a href="/discord/activity/character/new" class="activity-card">
        <div class="activity-icon">📜</div>
        <div class="activity-title">Character Sheet</div>
        <div class="activity-description">View and edit character stats</div>
      </a>

      <a href="/discord/activity/map" class="activity-card">
        <div class="activity-icon">🗺️</div>
        <div class="activity-title">Map Viewer <span class="badge">BETA</span></div>
        <div class="activity-description">Share and annotate battle maps</div>
      </a>

      <a href="/discord/activity/spells" class="activity-card">
        <div class="activity-icon">✨</div>
        <div class="activity-title">Spell Lookup</div>
        <div class="activity-description">Quick reference for spells and abilities</div>
      </a>
    </div>
  </div>

  <script>
    // Discord Activity SDK integration
    // TODO: Add Discord Activity SDK
    console.log('FumbleBot Activity loaded');

    // Example: Send message to Discord
    // window.parent.postMessage({ type: 'ACTIVITY_READY' }, 'https://discord.com');
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
