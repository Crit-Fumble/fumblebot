/**
 * VTT Bridge Utilities
 *
 * Helpers for creating a VTT bridge connection from outside the extension context
 * (e.g., from a Discord Activity or web app)
 */

import type { VTTConnectionStatus, VTTRoll, VTTMessage } from '../types';

export interface VTTBridgeConfig {
  /** FumbleBot API endpoint */
  apiUrl: string;
  /** User's auth token */
  token: string;
  /** Callbacks for VTT events */
  onStatusChange?: (status: VTTConnectionStatus) => void;
  onRoll?: (roll: VTTRoll) => void;
  onMessage?: (message: VTTMessage) => void;
  onError?: (error: Error) => void;
}

export interface VTTBridge {
  /** Current connection status */
  getStatus: () => VTTConnectionStatus | null;
  /** Send a message to the VTT */
  sendMessage: (content: string) => Promise<void>;
  /** Disconnect from the VTT bridge */
  disconnect: () => void;
}

/**
 * Create a VTT bridge connection
 *
 * This allows apps (like Discord Activities) to receive VTT events
 * from the browser extension via the FumbleBot API.
 */
export function createVTTBridge(config: VTTBridgeConfig): VTTBridge {
  const { apiUrl, token, onStatusChange, onRoll, onMessage, onError } = config;

  let status: VTTConnectionStatus | null = null;
  let eventSource: EventSource | null = null;

  // Connect to SSE endpoint
  const connect = () => {
    eventSource = new EventSource(`${apiUrl}/extension/bridge?token=${token}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'status':
            status = data.payload;
            if (status) onStatusChange?.(status);
            break;

          case 'roll':
            onRoll?.(data.payload);
            break;

          case 'message':
            onMessage?.(data.payload);
            break;
        }
      } catch (e) {
        console.error('[VTTBridge] Failed to parse event:', e);
      }
    };

    eventSource.onerror = () => {
      onError?.(new Error('Connection to VTT bridge lost'));
      // Attempt reconnect
      setTimeout(connect, 5000);
    };
  };

  connect();

  return {
    getStatus: () => status,

    sendMessage: async (content: string) => {
      const response = await fetch(`${apiUrl}/extension/bridge/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message to VTT');
      }
    },

    disconnect: () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    },
  };
}
