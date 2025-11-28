/**
 * Authentication Handlers
 * OAuth2 token exchange and authentication for Discord
 */

import type { Request, Response } from 'express';
import type { PlatformServerConfig } from '../models/types.js';
import { prisma } from '../services/db/client.js';
import { getSessionUser } from '../middleware.js';

/**
 * Handle OAuth2 token exchange for Discord Activity SDK
 * The Activity frontend sends the authorization code, we exchange it for an access_token
 */
export async function handleTokenExchange(req: Request, res: Response): Promise<void> {
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
      console.error('[Platform] Token exchange failed:', errorText);
      res.status(400).json({ error: 'Token exchange failed' });
      return;
    }

    const tokenData = await response.json();
    res.json({ access_token: tokenData.access_token });
  } catch (error) {
    console.error('[Platform] Token exchange error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Handle OAuth2 callback for web-based authentication
 * Receives code from Discord redirect, exchanges for token, stores in server-side session
 */
export async function handleOAuthCallback(
  req: Request,
  res: Response,
  config: PlatformServerConfig
): Promise<void> {
  const { code, error: oauthError, state } = req.query;

  // Parse return URL from state parameter
  const returnUrl = typeof state === 'string' ? state : '/web/activity';

  if (oauthError) {
    res.status(400).send(`
      <!DOCTYPE html>
      <html><head><title>Auth Error</title></head>
      <body style="background:#2b2d31;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
        <div style="text-align:center;">
          <h1>Authentication Error</h1>
          <p>${oauthError}</p>
          <a href="/" style="color:#5865f2;">Go back</a>
        </div>
      </body></html>
    `);
    return;
  }

  if (!code || typeof code !== 'string') {
    res.status(400).send('Missing authorization code');
    return;
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.FUMBLEBOT_DISCORD_CLIENT_ID!,
        client_secret: process.env.FUMBLEBOT_DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${config.publicUrl}/auth/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Platform] Web OAuth token exchange failed:', errorText);
      res.status(400).send('Token exchange failed');
      return;
    }

    const tokenData = await tokenResponse.json();

    // Fetch user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      res.status(400).send('Failed to fetch user info');
      return;
    }

    const discordUser = await userResponse.json();

    // Create or update AuthUser in database
    const authUser = await prisma.authUser.upsert({
      where: { discordId: discordUser.id },
      update: {
        username: discordUser.username,
        discriminator: discordUser.discriminator || null,
        avatar: discordUser.avatar,
        globalName: discordUser.global_name || null,
        email: discordUser.email || null,
      },
      create: {
        discordId: discordUser.id,
        username: discordUser.username,
        discriminator: discordUser.discriminator || null,
        avatar: discordUser.avatar,
        globalName: discordUser.global_name || null,
        email: discordUser.email || null,
      },
    });

    // Store user in server-side session
    req.session.user = {
      id: authUser.id,
      discordId: authUser.discordId,
      username: authUser.username,
      avatar: authUser.avatar,
      globalName: authUser.globalName,
    };
    req.session.accessToken = tokenData.access_token;
    req.session.expiresAt = Date.now() + (tokenData.expires_in * 1000);

    // Save session and redirect
    req.session.save((err) => {
      if (err) {
        console.error('[Platform] Session save error:', err);
        res.status(500).send('Session error');
        return;
      }

      // Redirect to the return URL (default: /web/activity)
      res.redirect(returnUrl);
    });
  } catch (error) {
    console.error('[Platform] Web OAuth callback error:', error);
    res.status(500).send('Internal server error');
  }
}

/**
 * Get current authenticated user from server-side session
 */
export function handleGetAuthUser(req: Request, res: Response): void {
  const user = getSessionUser(req);

  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  res.json({
    user: {
      id: user.id,
      discordId: user.discordId,
      username: user.username,
      avatar: user.avatar,
      globalName: user.globalName,
    },
  });
}

/**
 * Handle logout - destroy server-side session
 */
export function handleLogout(req: Request, res: Response): void {
  req.session.destroy((err) => {
    if (err) {
      console.error('[Platform] Session destroy error:', err);
      res.status(500).json({ error: 'Logout failed' });
      return;
    }
    res.clearCookie('fumblebot.sid');
    res.json({ success: true });
  });
}

/**
 * Get user's Discord guilds using server-side stored token
 * Query params:
 *   - botOnly=true: Only return guilds where FumbleBot is installed
 */
export async function handleGetUserGuilds(req: Request, res: Response): Promise<void> {
  const user = getSessionUser(req);

  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const accessToken = req.session.accessToken;
  if (!accessToken) {
    res.status(401).json({ error: 'No access token' });
    return;
  }

  const botOnly = req.query.botOnly === 'true';

  try {
    const response = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Platform] Discord guilds fetch failed:', errorText);
      res.status(400).json({ error: 'Failed to fetch guilds' });
      return;
    }

    let guilds = await response.json();

    // If botOnly, filter to guilds where FumbleBot is installed
    if (botOnly) {
      const installedGuilds = await prisma.guild.findMany({
        select: { guildId: true },
      });
      const installedGuildIds = new Set(installedGuilds.map((g: { guildId: string }) => g.guildId));
      guilds = guilds.filter((g: { id: string }) => installedGuildIds.has(g.id));
    }

    res.json({ guilds });
  } catch (error) {
    console.error('[Platform] Get guilds error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get user's active activities (sessions where they have a character)
 * Returns activities grouped by guild
 */
export async function handleGetUserActivities(req: Request, res: Response): Promise<void> {
  const user = getSessionUser(req);

  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const guildId = req.query.guildId as string | undefined;

  try {
    // Find all characters owned by this user
    const characters = await prisma.fumbleCharacter.findMany({
      where: {
        ownerId: user.discordId,
        isActive: true,
        isRetired: false,
        ...(guildId && {
          campaign: {
            guildId,
          },
        }),
      },
      include: {
        campaign: {
          include: {
            sessions: {
              where: {
                status: 'active',
              },
              orderBy: {
                startedAt: 'desc',
              },
              take: 1,
            },
            guild: {
              select: {
                guildId: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Group by guild and format response
    const activitiesByGuild: Record<string, {
      guildId: string;
      guildName: string | null;
      campaigns: Array<{
        id: string;
        name: string;
        hasActiveSession: boolean;
        activeSession: {
          id: string;
          name: string | null;
          channelId: string;
          startedAt: Date;
        } | null;
        characters: Array<{
          id: string;
          name: string;
          type: string;
          avatarUrl: string | null;
        }>;
      }>;
    }> = {};

    for (const char of characters) {
      const campaign = char.campaign;
      const guild = campaign.guild;
      const guildKey = guild.guildId;

      if (!activitiesByGuild[guildKey]) {
        activitiesByGuild[guildKey] = {
          guildId: guild.guildId,
          guildName: guild.name,
          campaigns: [],
        };
      }

      // Find or create campaign entry
      let campaignEntry = activitiesByGuild[guildKey].campaigns.find(c => c.id === campaign.id);
      if (!campaignEntry) {
        const activeSession = campaign.sessions[0] || null;
        campaignEntry = {
          id: campaign.id,
          name: campaign.name,
          hasActiveSession: !!activeSession,
          activeSession: activeSession ? {
            id: activeSession.id,
            name: activeSession.name,
            channelId: activeSession.channelId,
            startedAt: activeSession.startedAt,
          } : null,
          characters: [],
        };
        activitiesByGuild[guildKey].campaigns.push(campaignEntry);
      }

      campaignEntry.characters.push({
        id: char.id,
        name: char.name,
        type: char.type,
        avatarUrl: char.avatarUrl,
      });
    }

    // Convert to array and filter to only guilds with active sessions
    const activities = Object.values(activitiesByGuild).map(guild => ({
      ...guild,
      campaigns: guild.campaigns.filter(c => c.hasActiveSession),
    })).filter(guild => guild.campaigns.length > 0);

    res.json({ activities });
  } catch (error) {
    console.error('[Platform] Get user activities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
