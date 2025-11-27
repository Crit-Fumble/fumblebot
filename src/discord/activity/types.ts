/**
 * Discord Activity Types
 */

export interface ActivitySession {
  id: string;
  guildId: string;
  channelId: string;
  userId: string;
  activityType: ActivityType;
  state: any; // Activity-specific state
  participants: string[]; // User IDs
  createdAt: Date;
  updatedAt: Date;
}

export type ActivityType =
  | 'dice-roller'
  | 'character-sheet'
  | 'map-viewer'
  | 'initiative-tracker'
  | 'spell-lookup'
  | 'custom';

export interface ActivityConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  path: string;
  maxParticipants?: number;
  requiresVoice?: boolean;
}

export interface DiceRollActivity {
  type: 'DICE_ROLL';
  userId: string;
  notation: string;
  result: number;
  rolls: number[];
  modifier: number;
  timestamp: Date;
}

export interface InitiativeEntry {
  id: string;
  name: string;
  initiative: number;
  hp?: number;
  maxHp?: number;
  ac?: number;
  conditions?: string[];
  isPlayer: boolean;
}

export interface MapAnnotation {
  id: string;
  x: number;
  y: number;
  type: 'token' | 'marker' | 'line' | 'shape' | 'text';
  data: any;
  userId: string;
  timestamp: Date;
}
