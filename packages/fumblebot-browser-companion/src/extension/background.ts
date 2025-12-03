/**
 * Background service worker for FumbleBot Browser Companion
 *
 * Handles:
 * - OAuth authentication with Discord via FumbleBot
 * - Communication between content scripts and FumbleBot API
 * - Connection state management
 * - SSE connection for real-time updates from Discord
 */

import type { ExtensionMessage, VTTConnectionStatus, VTTEvent } from '../types';

const FUMBLEBOT_API = 'https://fumblebot.crit-fumble.com/api';

// Auth state
interface AuthState {
  isAuthenticated: boolean;
  user: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    globalName: string | null;
  } | null;
  token: string | null;
}

let authState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
};

// Connection state
let connectionStatus: VTTConnectionStatus = {
  platform: null,
  state: 'disconnected',
};

let eventSource: EventSource | null = null;

/**
 * Initialize the service worker
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('[FumbleBot] Extension installed');
  loadAuthState();
});

// Also load auth state when service worker starts
loadAuthState();

/**
 * Load saved auth state from storage
 */
function loadAuthState() {
  chrome.storage.local.get(['fumbleBotAuth'], (result) => {
    if (result.fumbleBotAuth) {
      authState = result.fumbleBotAuth;
      if (authState.isAuthenticated && authState.token) {
        connectToFumbleBot();
      }
    }
  });
}

/**
 * Save auth state to storage
 */
function saveAuthState() {
  chrome.storage.local.set({ fumbleBotAuth: authState });
}

/**
 * Start OAuth flow with Discord via FumbleBot
 */
async function startOAuthFlow(): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the extension's redirect URL for OAuth callback
    const redirectUrl = chrome.identity.getRedirectURL('oauth');
    console.log('[FumbleBot] OAuth redirect URL:', redirectUrl);

    // Build OAuth URL - FumbleBot proxies to Discord OAuth
    const authUrl = new URL(`${FUMBLEBOT_API}/auth/discord/extension`);
    authUrl.searchParams.set('redirect_uri', redirectUrl);

    // Launch the OAuth flow
    const responseUrl = await new Promise<string>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl.toString(),
          interactive: true,
        },
        (callbackUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (callbackUrl) {
            resolve(callbackUrl);
          } else {
            reject(new Error('No callback URL received'));
          }
        }
      );
    });

    // Parse the response URL to get token and user info
    const url = new URL(responseUrl);
    const token = url.searchParams.get('token');
    const userJson = url.searchParams.get('user');
    const error = url.searchParams.get('error');

    if (error) {
      return { success: false, error };
    }

    if (!token || !userJson) {
      return { success: false, error: 'Missing token or user data' };
    }

    // Parse user data
    const user = JSON.parse(decodeURIComponent(userJson));

    // Update auth state
    authState = {
      isAuthenticated: true,
      user,
      token,
    };
    saveAuthState();

    // Connect to FumbleBot SSE
    connectToFumbleBot();

    console.log('[FumbleBot] OAuth successful:', user.username);
    return { success: true };
  } catch (error) {
    console.error('[FumbleBot] OAuth error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'OAuth failed',
    };
  }
}

/**
 * Log out and clear auth state
 */
function logout() {
  authState = {
    isAuthenticated: false,
    user: null,
    token: null,
  };
  saveAuthState();
  disconnectFromFumbleBot();
  console.log('[FumbleBot] Logged out');
}

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage & { type: string }, _sender, sendResponse) => {
    switch (message.type) {
      case 'VTT_EVENT':
        handleVTTEvent(message.payload as VTTEvent);
        break;

      case 'GET_STATUS':
        sendResponse({
          type: 'STATUS_RESPONSE',
          payload: {
            ...connectionStatus,
            auth: authState,
          },
        });
        return true;

      case 'LOGIN':
        // Handle OAuth login
        startOAuthFlow().then((result) => {
          sendResponse({ type: 'LOGIN_RESPONSE', payload: result });
          // Notify popup of auth change
          broadcastAuthUpdate();
        });
        return true; // Keep channel open for async response

      case 'LOGOUT':
        logout();
        sendResponse({ type: 'LOGOUT_RESPONSE', payload: { success: true } });
        broadcastAuthUpdate();
        break;

      case 'CONNECT_FUMBLEBOT':
        // Legacy token-based auth (deprecated, but keep for compatibility)
        authState.token = (message.payload as { token: string }).token;
        saveAuthState();
        connectToFumbleBot();
        break;

      case 'DISCONNECT_FUMBLEBOT':
        disconnectFromFumbleBot();
        break;

      case 'SEND_TO_DISCORD':
        const discordPayload = message.payload as { channelId: string; message: string };
        sendToDiscord(discordPayload.channelId, discordPayload.message);
        break;
    }
  }
);

/**
 * Broadcast auth state update to popup
 */
function broadcastAuthUpdate() {
  chrome.runtime.sendMessage({
    type: 'AUTH_UPDATE',
    payload: authState,
  }).catch(() => {
    // Popup might not be open, ignore error
  });
}

/**
 * Handle VTT events from content scripts
 */
async function handleVTTEvent(event: VTTEvent) {
  switch (event.type) {
    case 'connected':
      connectionStatus = {
        platform: event.data.platform,
        state: 'connected',
        gameId: event.data.gameId,
        gameName: event.data.gameName,
        userId: event.data.currentUser.id,
        username: event.data.currentUser.name,
        lastActivity: new Date(),
      };
      await notifyFumbleBot('vtt-connected', event.data);
      break;

    case 'disconnected':
      connectionStatus = {
        ...connectionStatus,
        state: 'disconnected',
      };
      await notifyFumbleBot('vtt-disconnected', event.data);
      break;

    case 'roll':
      connectionStatus.lastActivity = new Date();
      await notifyFumbleBot('vtt-roll', event.data);
      break;

    case 'message':
      connectionStatus.lastActivity = new Date();
      await notifyFumbleBot('vtt-message', event.data);
      break;

    case 'error':
      connectionStatus = {
        ...connectionStatus,
        state: 'error',
        error: event.data.message,
      };
      break;
  }

  // Notify popup of status change
  chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', payload: connectionStatus }).catch(() => {
    // Popup might not be open, ignore error
  });
}

/**
 * Connect to FumbleBot SSE endpoint for real-time Discord messages
 */
function connectToFumbleBot() {
  if (!authState.token) return;

  if (eventSource) {
    eventSource.close();
  }

  connectionStatus.state = 'connecting';

  eventSource = new EventSource(`${FUMBLEBOT_API}/extension/events?token=${authState.token}`);

  eventSource.onopen = () => {
    console.log('[FumbleBot] Connected to FumbleBot');
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleFumbleBotEvent(data);
    } catch (e) {
      console.error('[FumbleBot] Failed to parse event:', e);
    }
  };

  eventSource.onerror = (error) => {
    console.error('[FumbleBot] SSE error:', error);
    connectionStatus.state = 'error';
    connectionStatus.error = 'Connection to FumbleBot lost';

    // Attempt to reconnect after 5 seconds
    setTimeout(connectToFumbleBot, 5000);
  };
}

/**
 * Disconnect from FumbleBot
 */
function disconnectFromFumbleBot() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  connectionStatus.state = 'disconnected';
}

/**
 * Handle events from FumbleBot (Discord messages to relay to VTT)
 */
function handleFumbleBotEvent(event: { type: string; data: unknown }) {
  switch (event.type) {
    case 'discord-message':
      // Relay message to active VTT tab
      relayToVTT('DISCORD_MESSAGE', event.data);
      break;

    case 'discord-roll':
      relayToVTT('DISCORD_ROLL', event.data);
      break;
  }
}

/**
 * Send event to FumbleBot API
 */
async function notifyFumbleBot(eventType: string, data: unknown) {
  if (!authState.token) return;

  try {
    await fetch(`${FUMBLEBOT_API}/extension/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authState.token}`,
      },
      body: JSON.stringify({ type: eventType, data }),
    });
  } catch (error) {
    console.error('[FumbleBot] Failed to notify API:', error);
  }
}

/**
 * Send message to Discord via FumbleBot
 */
async function sendToDiscord(channelId: string, message: string) {
  if (!authState.token) return;

  try {
    await fetch(`${FUMBLEBOT_API}/extension/discord/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authState.token}`,
      },
      body: JSON.stringify({ channelId, message }),
    });
  } catch (error) {
    console.error('[FumbleBot] Failed to send to Discord:', error);
  }
}

/**
 * Relay message to VTT content script
 */
async function relayToVTT(type: string, data: unknown) {
  // Find active VTT tab
  const tabs = await chrome.tabs.query({
    url: [
      'https://app.roll20.net/*',
      'https://www.dndbeyond.com/*',
      'http://localhost:30000/*',
    ],
  });

  for (const tab of tabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { type, data }).catch(() => {
        // Tab might not have content script loaded
      });
    }
  }
}
