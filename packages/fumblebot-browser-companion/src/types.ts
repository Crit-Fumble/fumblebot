/**
 * Supported VTT platforms
 */
export type VTTPlatform = 'roll20' | 'dndbeyond' | 'foundry';

/**
 * Supported game systems
 */
export type GameSystem =
  | 'dnd5e'
  | 'dnd5e-2024'
  | 'pf2e'
  | 'cypher'      // Cypher System (Numenera, The Strange, etc.)
  | 'coc'         // Call of Cthulhu
  | 'swade'       // Savage Worlds
  | 'generic';

/**
 * Connection states for VTT bridge
 */
export type VTTConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Full connection status including platform info
 */
export interface VTTConnectionStatus {
  platform: VTTPlatform | null;
  state: VTTConnectionState;
  gameId?: string;
  gameName?: string;
  userId?: string;
  username?: string;
  error?: string;
  lastActivity?: Date;
}

/**
 * Parsed roll from any VTT platform
 */
export interface VTTRoll {
  id: string;
  platform: VTTPlatform;
  gameSystem?: GameSystem;
  timestamp: Date;
  roller: {
    id: string;
    name: string;
  };
  expression: string;
  results: number[];
  total: number;
  label?: string;
  characterName?: string;
  rollType?: 'attack' | 'damage' | 'save' | 'check' | 'initiative' | 'skill' | 'ability' | 'custom';
  critical?: boolean;
  fumble?: boolean;
  // Cypher System specific
  cypherEffect?: 'minor' | 'major' | 'gm-intrusion';
  // Advantage/Disadvantage
  advantage?: boolean;
  disadvantage?: boolean;
  raw: unknown; // Original platform-specific data
}

/**
 * Chat message from VTT
 */
export interface VTTMessage {
  id: string;
  platform: VTTPlatform;
  timestamp: Date;
  sender: {
    id: string;
    name: string;
  };
  content: string;
  type: 'chat' | 'emote' | 'whisper' | 'system';
  characterName?: string;
  raw: unknown;
}

/**
 * Information about current VTT session/game
 */
export interface VTTSessionInfo {
  platform: VTTPlatform;
  gameId: string;
  gameName: string;
  players: Array<{
    id: string;
    name: string;
    isGM: boolean;
  }>;
  currentUser: {
    id: string;
    name: string;
    isGM: boolean;
  };
}

/**
 * Events emitted by content scripts
 */
export type VTTEvent =
  | { type: 'connected'; data: VTTSessionInfo }
  | { type: 'disconnected'; data: { reason: string } }
  | { type: 'roll'; data: VTTRoll }
  | { type: 'message'; data: VTTMessage }
  | { type: 'error'; data: { message: string; code?: string } };

/**
 * Auth state for Discord OAuth
 */
export interface AuthState {
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

/**
 * Messages between content scripts and background service worker
 */
export type ExtensionMessage =
  | { type: 'VTT_EVENT'; payload: VTTEvent }
  | { type: 'GET_STATUS'; payload?: undefined }
  | { type: 'STATUS_RESPONSE'; payload: VTTConnectionStatus & { auth?: AuthState } }
  | { type: 'CONNECT_FUMBLEBOT'; payload: { token: string } }
  | { type: 'DISCONNECT_FUMBLEBOT'; payload?: undefined }
  | { type: 'SEND_TO_DISCORD'; payload: { channelId: string; message: string } }
  | { type: 'LOGIN'; payload?: undefined }
  | { type: 'LOGIN_RESPONSE'; payload: { success: boolean; error?: string } }
  | { type: 'LOGOUT'; payload?: undefined }
  | { type: 'LOGOUT_RESPONSE'; payload: { success: boolean } }
  | { type: 'STATUS_UPDATE'; payload: VTTConnectionStatus }
  | { type: 'AUTH_UPDATE'; payload: AuthState };
