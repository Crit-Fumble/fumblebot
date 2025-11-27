/**
 * FumbleBot API Server
 * Handles Discord OAuth, webhooks, and admin dashboard
 * Runs independently at https://fumblebot.crit-fumble.com
 */

import express, { Request, Response, NextFunction } from 'express'
import session from 'express-session'
import cookieParser from 'cookie-parser'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { ExpressAuth } from '@auth/express'
import Discord from '@auth/express/providers/discord'
import { loadConfig } from '../config.js'
import { db } from '../db/index.js'
import type { FumbleBotClient } from '../discord/client.js'

export interface APIServerConfig {
  port: number
  host: string
}

export interface APIServerOptions {
  discordClient?: FumbleBotClient
}

export class APIServer {
  private app: express.Application
  private server: any | null = null
  private config: ReturnType<typeof loadConfig>
  private discordClient?: FumbleBotClient

  constructor(options: APIServerOptions = {}) {
    this.config = loadConfig()
    this.discordClient = options.discordClient
    this.app = express()
    this.setupMiddleware()
    this.setupRoutes()
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Body parsing
    this.app.use(express.json())
    this.app.use(express.urlencoded({ extended: true }))
    this.app.use(cookieParser())

    // CORS
    this.app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      if (req.method === 'OPTIONS') {
        res.sendStatus(204)
        return
      }
      next()
    })

    // Session configuration - shared with main site
    const authSecret =
      process.env.AUTH_SECRET ||
      process.env.FUMBLEBOT_DISCORD_CLIENT_SECRET ||
      process.env.NEXTAUTH_SECRET ||
      'fumblebot-dev-secret'

    this.app.use(
      session({
        secret: authSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          sameSite: 'lax',
        },
      })
    )

    // Auth.js Express adapter
    this.app.use(
      '/auth',
      ExpressAuth({
        providers: [
          Discord({
            clientId: process.env.FUMBLEBOT_DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID!,
            clientSecret: process.env.FUMBLEBOT_DISCORD_CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET!,
          }),
        ],
        secret: authSecret,
        trustHost: true,
      })
    )
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/api/health', this.handleHealth.bind(this))

    // Discord verification
    this.app.post('/api/discord/verify', this.handleDiscordVerify.bind(this))

    // Discord interactions webhook
    this.app.post('/api/discord/interactions', this.handleDiscordInteractions.bind(this))

    // Stats endpoint
    this.app.get('/api/stats', this.handleStats.bind(this))

    // Proxy Discord Activity routes to activity server (port 3000)
    this.app.use('/discord/activity', this.proxyToActivityServer.bind(this))

    // Login page
    this.app.get('/login', this.handleLoginPage.bind(this))

    // Admin dashboard (protected)
    this.app.get('/admin', this.requireAuth.bind(this), this.requireAdmin.bind(this), this.handleAdminPage.bind(this))

    // Admin API endpoints
    this.app.get('/api/admin/bot-status', this.requireAuth.bind(this), this.requireAdmin.bind(this), this.handleBotStatus.bind(this))
    this.app.get('/api/admin/guilds', this.requireAuth.bind(this), this.requireAdmin.bind(this), this.handleGuildsList.bind(this))
    this.app.get('/api/admin/stats', this.requireAuth.bind(this), this.requireAdmin.bind(this), this.handleAdminStats.bind(this))

    // Logout
    this.app.post('/api/auth/logout', this.handleLogout.bind(this))

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' })
    })

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('[API Server] Error:', err)
      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
      })
    })
  }

  /**
   * Start the API server
   */
  start(serverConfig: APIServerConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(serverConfig.port, serverConfig.host, () => {
        console.log(`[API Server] Listening on http://${serverConfig.host}:${serverConfig.port}`)
        resolve()
      })

      this.server.on('error', (error: Error) => {
        console.error('[API Server] Error:', error)
        reject(error)
      })
    })
  }

  /**
   * Stop the API server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[API Server] Stopped')
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  /**
   * Set Discord client (for accessing bot status)
   */
  setDiscordClient(client: FumbleBotClient): void {
    this.discordClient = client
  }

  /**
   * Proxy requests to the activity server
   */
  private proxyToActivityServer(req: Request, res: Response, next: NextFunction): void {
    const proxy = createProxyMiddleware({
      target: 'http://localhost:3000',
      changeOrigin: true,
      pathRewrite: {
        '^/discord/activity': '/discord/activity', // Keep the path as is
      },
    })
    proxy(req, res, next)
  }

  // ===========================================
  // Middleware
  // ===========================================

  /**
   * Require authentication middleware
   */
  private async requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check for session
    const sessionData = (req as any).session
    if (!sessionData || !sessionData.userId) {
      res.status(401).json({ error: 'Unauthorized - Please login' })
      return
    }

    // Attach user to request
    ;(req as any).user = { id: sessionData.userId }
    next()
  }

  /**
   * Require admin middleware - checks if user is admin on home guild
   */
  private async requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    const user = (req as any).user

    if (!user || !user.id) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    try {
      // Get home guild ID
      const homeGuildId = this.config.discord.guildId

      if (!homeGuildId) {
        res.status(500).json({ error: 'Home guild not configured' })
        return
      }

      // Check if Discord client is available
      if (!this.discordClient) {
        console.warn('[Admin Check] Discord client not available, allowing access')
        next()
        return
      }

      // Get the guild
      const guild = await this.discordClient.client.guilds.fetch(homeGuildId).catch(() => null)

      if (!guild) {
        res.status(403).json({ error: 'Bot not in home guild' })
        return
      }

      // Get the member
      const member = await guild.members.fetch(user.id).catch(() => null)

      if (!member) {
        res.status(403).json({ error: 'Not a member of the home guild' })
        return
      }

      // Check if member is admin
      if (!member.permissions.has('Administrator')) {
        res.status(403).json({ error: 'Insufficient permissions - Admin required' })
        return
      }

      // User is admin, proceed
      next()
    } catch (error) {
      console.error('[Admin Check] Error:', error)
      res.status(500).json({ error: 'Failed to verify admin status' })
    }
  }

  // ===========================================
  // Route Handlers
  // ===========================================

  /**
   * Health check endpoint
   */
  private async handleHealth(req: Request, res: Response): Promise<void> {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'fumblebot-api',
    })
  }

  /**
   * Discord OAuth verification endpoint
   */
  private async handleDiscordVerify(req: Request, res: Response): Promise<void> {
    const { discordId, username, guildId } = req.body

    if (!discordId || !username || !guildId) {
      res.status(400).json({ error: 'Missing required fields: discordId, username, guildId' })
      return
    }

    try {
      await db.ensureGuild(guildId)
      await db.ensureGuildMember(guildId, discordId, username)
      const guild = await db.getGuild(guildId)

      res.json({
        success: true,
        isHomeGuild: guild?.isHome || false,
        message: 'User verified and linked',
      })
    } catch (error) {
      console.error('[Discord Verify] Error:', error)
      res.status(500).json({ error: 'Failed to verify user' })
    }
  }

  /**
   * Discord interactions webhook endpoint
   */
  private async handleDiscordInteractions(req: Request, res: Response): Promise<void> {
    const signature = req.headers['x-signature-ed25519'] as string
    const timestamp = req.headers['x-signature-timestamp'] as string

    if (!signature || !timestamp) {
      res.status(401).json({ error: 'Missing signature headers' })
      return
    }

    // Verify Discord signature (placeholder)
    const body = req.body

    // Handle ping
    if (body.type === 1) {
      res.json({ type: 1 })
      return
    }

    // For other interactions, respond with "processing"
    res.json({ type: 5 })
  }

  /**
   * Stats endpoint
   */
  private async handleStats(req: Request, res: Response): Promise<void> {
    const guildId = req.query.guildId as string

    if (!guildId) {
      res.status(400).json({ error: 'Missing guildId parameter' })
      return
    }

    try {
      const stats = await db.getCommandStats(guildId, 30)
      res.json({
        guildId,
        period: '30 days',
        commands: stats,
      })
    } catch (error) {
      console.error('[Stats] Error:', error)
      res.status(500).json({ error: 'Failed to fetch stats' })
    }
  }

  /**
   * Login page
   */
  private handleLoginPage(req: Request, res: Response): void {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FumbleBot - Login</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 48px;
      max-width: 450px;
      width: 100%;
      text-align: center;
    }
    .logo {
      font-size: 64px;
      margin-bottom: 16px;
    }
    h1 {
      color: #1a202c;
      font-size: 32px;
      margin-bottom: 8px;
    }
    p {
      color: #718096;
      margin-bottom: 32px;
      line-height: 1.6;
    }
    .btn-discord {
      background: #5865F2;
      color: white;
      border: none;
      padding: 16px 32px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      transition: all 0.2s;
    }
    .btn-discord:hover {
      background: #4752C4;
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(88, 101, 242, 0.3);
    }
    .discord-icon {
      width: 24px;
      height: 24px;
    }
    .info {
      margin-top: 32px;
      padding-top: 32px;
      border-top: 1px solid #e2e8f0;
      color: #718096;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🎲</div>
    <h1>FumbleBot Admin</h1>
    <p>Sign in with Discord to access the FumbleBot admin dashboard. You must be an administrator on the home server to access admin features.</p>

    <a href="/auth/signin/discord" class="btn-discord">
      <svg class="discord-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
      Sign in with Discord
    </a>

    <div class="info">
      <strong>Admin Access Required</strong><br>
      Only administrators of the home server can access the admin dashboard.
    </div>
  </div>
</body>
</html>
    `)
  }

  /**
   * Admin dashboard page
   */
  private handleAdminPage(req: Request, res: Response): void {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FumbleBot - Admin Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: #f7fafc;
      min-height: 100vh;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 24px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h1 {
      font-size: 28px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .btn-logout {
      background: rgba(255,255,255,0.2);
      color: white;
      border: 1px solid rgba(255,255,255,0.3);
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }
    .btn-logout:hover {
      background: rgba(255,255,255,0.3);
    }
    .container {
      max-width: 1200px;
      margin: 32px auto;
      padding: 0 24px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
      margin-bottom: 32px;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .card h2 {
      color: #2d3748;
      font-size: 18px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .stat {
      font-size: 36px;
      font-weight: 700;
      color: #667eea;
      margin-bottom: 4px;
    }
    .stat-label {
      color: #718096;
      font-size: 14px;
    }
    .status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
    }
    .status.online {
      background: #c6f6d5;
      color: #22543d;
    }
    .status.offline {
      background: #fed7d7;
      color: #742a2a;
    }
    .loading {
      text-align: center;
      padding: 48px;
      color: #718096;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-content">
      <h1>🎲 FumbleBot Admin</h1>
      <button class="btn-logout" onclick="logout()">Logout</button>
    </div>
  </div>

  <div class="container">
    <div class="grid">
      <div class="card">
        <h2>🤖 Bot Status</h2>
        <div id="bot-status" class="loading">Loading...</div>
      </div>

      <div class="card">
        <h2>🏰 Guilds</h2>
        <div id="guild-count" class="loading">Loading...</div>
      </div>

      <div class="card">
        <h2>📊 Commands (30d)</h2>
        <div id="command-stats" class="loading">Loading...</div>
      </div>
    </div>

    <div class="card">
      <h2>🏰 Guild List</h2>
      <div id="guild-list" class="loading">Loading...</div>
    </div>
  </div>

  <script>
    async function loadData() {
      try {
        // Load bot status
        const statusRes = await fetch('/api/admin/bot-status');
        const status = await statusRes.json();
        document.getElementById('bot-status').innerHTML = \`
          <div class="status \${status.discord.ready ? 'online' : 'offline'}">
            \${status.discord.ready ? '🟢 Online' : '🔴 Offline'}
          </div>
          <div style="margin-top: 12px; font-size: 14px; color: #718096;">
            <div><strong>User:</strong> \${status.discord.user || 'N/A'}</div>
            <div><strong>OpenAI:</strong> \${status.ai.openai ? '✅' : '❌'}</div>
            <div><strong>Anthropic:</strong> \${status.ai.anthropic ? '✅' : '❌'}</div>
          </div>
        \`;

        // Load guilds
        const guildsRes = await fetch('/api/admin/guilds');
        const guilds = await guildsRes.json();
        document.getElementById('guild-count').innerHTML = \`
          <div class="stat">\${guilds.total}</div>
          <div class="stat-label">Total Guilds</div>
        \`;

        // Render guild list
        document.getElementById('guild-list').innerHTML = \`
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 2px solid #e2e8f0; text-align: left;">
                <th style="padding: 12px;">Guild Name</th>
                <th style="padding: 12px;">Members</th>
                <th style="padding: 12px;">Home</th>
              </tr>
            </thead>
            <tbody>
              \${guilds.guilds.map(g => \`
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 12px;">\${g.name}</td>
                  <td style="padding: 12px;">\${g.memberCount || 'N/A'}</td>
                  <td style="padding: 12px;">\${g.isHome ? '🏠' : ''}</td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        \`;

        // Load stats
        const homeGuild = guilds.guilds.find(g => g.isHome);
        if (homeGuild) {
          const statsRes = await fetch(\`/api/admin/stats?guildId=\${homeGuild.id}\`);
          const stats = await statsRes.json();
          const totalCommands = stats.commands.reduce((sum, cmd) => sum + cmd.count, 0);
          document.getElementById('command-stats').innerHTML = \`
            <div class="stat">\${totalCommands}</div>
            <div class="stat-label">Total Commands</div>
          \`;
        } else {
          document.getElementById('command-stats').innerHTML = '<div style="color: #718096;">No home guild</div>';
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    }

    async function logout() {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    }

    loadData();
  </script>
</body>
</html>
    `)
  }

  /**
   * Bot status endpoint
   */
  private handleBotStatus(req: Request, res: Response): void {
    if (!this.discordClient) {
      res.json({
        discord: { ready: false, user: null },
        ai: { openai: false, anthropic: false },
        api: { connected: true },
      })
      return
    }

    res.json({
      discord: {
        ready: this.discordClient.ready,
        user: this.discordClient.user?.tag || null,
      },
      ai: {
        openai: true, // Would need to check AIService
        anthropic: true, // Would need to check AIService
      },
      api: {
        connected: true,
      },
    })
  }

  /**
   * Guilds list endpoint
   */
  private async handleGuildsList(req: Request, res: Response): Promise<void> {
    if (!this.discordClient) {
      res.json({ total: 0, guilds: [] })
      return
    }

    try {
      const guilds = await this.discordClient.client.guilds.fetch()
      const guildData = await Promise.all(
        Array.from(guilds.values()).map(async (guild) => {
          const fullGuild = await guild.fetch()
          const dbGuild = await db.getGuild(guild.id)
          return {
            id: guild.id,
            name: fullGuild.name,
            memberCount: fullGuild.memberCount,
            isHome: dbGuild?.isHome || false,
          }
        })
      )

      res.json({
        total: guildData.length,
        guilds: guildData,
      })
    } catch (error) {
      console.error('[Guilds List] Error:', error)
      res.status(500).json({ error: 'Failed to fetch guilds' })
    }
  }

  /**
   * Admin stats endpoint
   */
  private async handleAdminStats(req: Request, res: Response): Promise<void> {
    const guildId = req.query.guildId as string

    if (!guildId) {
      res.status(400).json({ error: 'Missing guildId parameter' })
      return
    }

    try {
      const stats = await db.getCommandStats(guildId, 30)
      res.json({
        guildId,
        period: '30 days',
        commands: stats,
      })
    } catch (error) {
      console.error('[Admin Stats] Error:', error)
      res.status(500).json({ error: 'Failed to fetch stats' })
    }
  }

  /**
   * Logout handler
   */
  private handleLogout(req: Request, res: Response): void {
    req.session?.destroy((err) => {
      if (err) {
        console.error('[Logout] Error:', err)
      }
      res.json({ success: true })
    })
  }
}
