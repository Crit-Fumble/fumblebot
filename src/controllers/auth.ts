/**
 * Authentication Handlers
 * OAuth2 token exchange and authentication for Discord
 *
 * All user/activity/guild data is fetched from core API.
 * Express sessions are managed locally via express-session middleware.
 */

import type { Request, Response } from 'express';
import crypto from 'crypto';
import type { AuthActivitiesResponse } from '@crit-fumble/core';
import type { PlatformServerConfig } from '../models/types.js';
import { getSessionUser } from '../middleware.js';
import { getCoreProxyConfig, loadDiscordConfig } from '../config.js';

/**
 * Get Core API URL from centralized config
 * CORE_SERVER_URL must be set in production (e.g., http://10.x.x.x for VPC)
 */
function getCoreApiUrl(): string {
  const coreConfig = getCoreProxyConfig();
  if (!coreConfig) {
    throw new Error('CORE_SERVER_URL environment variable is required');
  }
  // Only add port if not already included in URL
  return coreConfig.url.includes(':') ? coreConfig.url : `${coreConfig.url}:${coreConfig.port}`;
}

function getCoreSecret(): string {
  const coreConfig = getCoreProxyConfig();
  return coreConfig?.secret || '';
}

/**
 * Make authenticated request to core API
 */
async function coreApiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${getCoreApiUrl()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Core-Secret': getCoreSecret(),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Core API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Allowed redirect paths for OAuth callback
 * Only allow internal paths, never external URLs
 */
const ALLOWED_RETURN_PATHS = new Set([
  '/web/activity',
  '/web/dashboard',
  '/web/campaigns',
  '/web/settings',
  '/',
]);

/**
 * Validate and sanitize return URL
 * Only allows whitelisted internal paths to prevent open redirect
 */
function sanitizeReturnUrl(rawUrl: string | undefined): string {
  const defaultPath = '/web/activity';

  if (!rawUrl || typeof rawUrl !== 'string') {
    return defaultPath;
  }

  // Parse the URL to extract just the path
  try {
    // Handle both full URLs and paths
    const url = rawUrl.startsWith('/') ? rawUrl : new URL(rawUrl).pathname;

    // Only allow whitelisted paths
    if (ALLOWED_RETURN_PATHS.has(url)) {
      return url;
    }

    // Check if it's a subpath of an allowed path
    for (const allowed of ALLOWED_RETURN_PATHS) {
      if (url.startsWith(allowed + '/')) {
        return url;
      }
    }
  } catch {
    // Invalid URL, use default
  }

  return defaultPath;
}

/**
 * HTML escape function to prevent XSS
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate a cryptographic state token for CSRF protection
 */
export function generateOAuthState(returnPath: string): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const sanitizedPath = sanitizeReturnUrl(returnPath);
  // Format: nonce:path - will be validated on callback
  return Buffer.from(`${nonce}:${sanitizedPath}`).toString('base64url');
}

/**
 * Parse and validate OAuth state token
 * Returns the return path if valid, null if invalid
 */
function parseOAuthState(state: string | undefined): { returnPath: string; nonce: string } | null {
  if (!state || typeof state !== 'string') {
    return null;
  }

  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) {
      return null;
    }

    const nonce = decoded.substring(0, colonIndex);
    const returnPath = decoded.substring(colonIndex + 1);

    // Validate nonce format (32 hex chars)
    if (!/^[a-f0-9]{32}$/.test(nonce)) {
      return null;
    }

    // Validate return path against whitelist
    const sanitized = sanitizeReturnUrl(returnPath);

    return { nonce, returnPath: sanitized };
  } catch {
    return null;
  }
}

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
    const discordConfig = loadDiscordConfig();
    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: discordConfig.clientId,
        client_secret: discordConfig.clientSecret,
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
 *
 * Security:
 * - CSRF protection via state token with cryptographic nonce
 * - Open redirect protection via path whitelist
 * - XSS protection via HTML escaping
 */
export async function handleOAuthCallback(
  req: Request,
  res: Response,
  config: PlatformServerConfig
): Promise<void> {
  const { code, error: oauthError, state } = req.query;

  // Parse and validate state token for CSRF protection
  const stateResult = parseOAuthState(state as string | undefined);
  if (!stateResult) {
    console.warn('[Platform] OAuth callback with invalid state token');
    res.status(400).send(`
      <!DOCTYPE html>
      <html><head><title>Auth Error</title></head>
      <body style="background:#2b2d31;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
        <div style="text-align:center;">
          <h1>Authentication Error</h1>
          <p>Invalid or expired authentication request. Please try again.</p>
          <a href="/" style="color:#5865f2;">Go back</a>
        </div>
      </body></html>
    `);
    return;
  }

  const returnUrl = stateResult.returnPath;

  if (oauthError) {
    // HTML escape the error message to prevent XSS
    const safeError = escapeHtml(String(oauthError));
    res.status(400).send(`
      <!DOCTYPE html>
      <html><head><title>Auth Error</title></head>
      <body style="background:#2b2d31;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
        <div style="text-align:center;">
          <h1>Authentication Error</h1>
          <p>${safeError}</p>
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
    const discordConfig = loadDiscordConfig();
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: discordConfig.clientId,
        client_secret: discordConfig.clientSecret,
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

    // Create or update user via core API
    // First, try to find existing user by Discord account
    let authUser: { id: string; email?: string | null; name?: string | null; image?: string | null };
    try {
      authUser = await coreApiRequest<typeof authUser>(
        `/api/auth/user/account?provider=discord&providerAccountId=${discordUser.id}`
      );

      // User exists, update their info
      authUser = await coreApiRequest<typeof authUser>(
        `/api/auth/user/${authUser.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: discordUser.global_name || discordUser.username,
            image: discordUser.avatar
              ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
              : null,
            email: discordUser.email || null,
          }),
        }
      );
    } catch {
      // User doesn't exist, create new user and link account
      authUser = await coreApiRequest<typeof authUser>(
        '/api/auth/user',
        {
          method: 'POST',
          body: JSON.stringify({
            name: discordUser.global_name || discordUser.username,
            image: discordUser.avatar
              ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
              : null,
            email: discordUser.email || null,
          }),
        }
      );

      // Link Discord account
      await coreApiRequest(
        '/api/auth/account',
        {
          method: 'POST',
          body: JSON.stringify({
            userId: authUser.id,
            type: 'oauth',
            provider: 'discord',
            providerAccountId: discordUser.id,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: tokenData.expires_in
              ? Math.floor(Date.now() / 1000) + tokenData.expires_in
              : null,
            token_type: tokenData.token_type,
            scope: tokenData.scope,
          }),
        }
      );
    }

    // Store user in server-side session
    req.session.user = {
      id: authUser.id,
      discordId: discordUser.id,
      username: discordUser.username,
      avatar: discordUser.avatar,
      globalName: discordUser.global_name,
    };
    req.session.accessToken = tokenData.access_token;
    req.session.expiresAt = Date.now() + (tokenData.expires_in * 1000);

    // Save session and redirect to validated path
    req.session.save((err) => {
      if (err) {
        console.error('[Platform] Session save error:', err);
        res.status(500).send('Session error');
        return;
      }

      // Redirect to the validated return URL (from whitelist only)
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
 *
 * Uses Discord API for guild list, core API for bot installation check.
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
    // Fetch user's guilds from Discord
    const response = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Platform] Discord guilds fetch failed:', errorText);
      res.status(400).json({ error: 'Failed to fetch guilds' });
      return;
    }

    let guilds: Array<{ id: string; permissions: string }> = await response.json();

    // Cache guild permissions in session for admin role determination
    // Discord returns permissions as a string (large integer)
    const guildPermissions: Record<string, string> = {};
    for (const guild of guilds) {
      if (guild.permissions) {
        guildPermissions[guild.id] = guild.permissions;
      }
    }
    req.session.guildPermissions = guildPermissions;

    // If botOnly, filter to guilds where FumbleBot is installed
    // Check with core API which guilds exist in our database
    if (botOnly && guilds.length > 0) {
      const guildIds = guilds.map((g: { id: string }) => g.id).join(',');
      const { guilds: knownGuilds } = await coreApiRequest<{ guilds: Array<{ guildId: string }> }>(
        `/api/auth/guilds?guildIds=${encodeURIComponent(guildIds)}`
      );
      const installedGuildIds = new Set(knownGuilds.map(g => g.guildId));
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
 *
 * Uses core API: GET /api/auth/activities?discordId=&guildIds=
 */
export async function handleGetUserActivities(req: Request, res: Response): Promise<void> {
  const user = getSessionUser(req);

  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const guildId = req.query.guildId as string | undefined;

  try {
    // Build query params for core API
    const params = new URLSearchParams({ discordId: user.discordId });
    if (guildId) {
      params.set('guildIds', guildId);
    }

    // Fetch activities from core API
    const { activities } = await coreApiRequest<AuthActivitiesResponse>(
      `/api/auth/activities?${params.toString()}`
    );

    res.json({ activities });
  } catch (error) {
    console.error('[Platform] Get user activities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
