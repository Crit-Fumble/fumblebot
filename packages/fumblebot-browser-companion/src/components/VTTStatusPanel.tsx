import React from 'react';
import { Card, Badge, Button, Spinner } from '@crit-fumble/react/shared';
import type { VTTConnectionStatus, VTTPlatform } from '../types';

export interface VTTStatusPanelProps {
  /** Current VTT connection status */
  status: VTTConnectionStatus | null;
  /** Whether data is loading */
  loading?: boolean;
  /** Callback when user clicks connect */
  onConnect?: () => void;
  /** Callback when user clicks disconnect */
  onDisconnect?: () => void;
  /** Additional CSS classes */
  className?: string;
}

const PLATFORM_INFO: Record<VTTPlatform, { name: string; color: string; icon: string }> = {
  roll20: {
    name: 'Roll20',
    color: 'bg-red-500',
    icon: '/img/roll20.png',
  },
  dndbeyond: {
    name: 'D&D Beyond',
    color: 'bg-red-600',
    icon: '/img/dndbeyond.png',
  },
  foundry: {
    name: 'Foundry VTT',
    color: 'bg-orange-500',
    icon: '/img/foundry.png',
  },
};

const STATE_BADGES: Record<
  VTTConnectionStatus['state'],
  { label: string; color: string }
> = {
  connected: { label: 'Connected', color: 'bg-green-500' },
  connecting: { label: 'Connecting...', color: 'bg-yellow-500' },
  disconnected: { label: 'Disconnected', color: 'bg-gray-500' },
  error: { label: 'Error', color: 'bg-red-500' },
};

/**
 * VTTStatusPanel - Displays the current VTT connection status
 *
 * This component can be used in:
 * - Discord Activity UI
 * - Browser extension popup
 * - Web dashboard
 */
export function VTTStatusPanel({
  status,
  loading = false,
  onConnect,
  onDisconnect,
  className = '',
}: VTTStatusPanelProps) {
  if (loading) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center justify-center">
          <Spinner size="md" />
          <span className="ml-2 text-gray-400">Checking VTT status...</span>
        </div>
      </Card>
    );
  }

  if (!status || !status.platform) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="text-center">
          <p className="text-gray-400 mb-3">No VTT connection detected</p>
          <p className="text-sm text-gray-500 mb-4">
            Open Roll20, D&D Beyond, or Foundry VTT with the browser extension installed.
          </p>
          {onConnect && (
            <Button variant="ghost" size="sm" onClick={onConnect}>
              Install Extension
            </Button>
          )}
        </div>
      </Card>
    );
  }

  const platformInfo = PLATFORM_INFO[status.platform];
  const stateInfo = STATE_BADGES[status.state];

  return (
    <Card className={`p-4 ${className}`}>
      {/* Header with platform info */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded ${platformInfo.color} flex items-center justify-center`}>
            <span className="text-white text-xs font-bold">
              {platformInfo.name.charAt(0)}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-sm">{platformInfo.name}</h3>
            {status.gameName && (
              <p className="text-xs text-gray-400">{status.gameName}</p>
            )}
          </div>
        </div>
        <Badge className={stateInfo.color}>{stateInfo.label}</Badge>
      </div>

      {/* Connection details */}
      {status.state === 'connected' && (
        <div className="space-y-2 text-sm">
          {status.username && (
            <div className="flex justify-between">
              <span className="text-gray-400">Player</span>
              <span>{status.username}</span>
            </div>
          )}
          {status.lastActivity && (
            <div className="flex justify-between">
              <span className="text-gray-400">Last Activity</span>
              <span>{formatRelativeTime(status.lastActivity)}</span>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {status.state === 'error' && status.error && (
        <div className="mt-2 p-2 bg-red-900/30 border border-red-800 rounded text-sm text-red-200">
          {status.error}
        </div>
      )}

      {/* Actions */}
      {status.state === 'connected' && onDisconnect && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDisconnect}
          className="w-full mt-3"
        >
          Disconnect
        </Button>
      )}

      {status.state === 'disconnected' && onConnect && (
        <Button size="sm" onClick={onConnect} className="w-full mt-3">
          Connect
        </Button>
      )}

      {status.state === 'error' && onConnect && (
        <Button size="sm" onClick={onConnect} className="w-full mt-3">
          Retry Connection
        </Button>
      )}
    </Card>
  );
}

/**
 * Format a date as relative time (e.g., "2 minutes ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return date.toLocaleDateString();
}
