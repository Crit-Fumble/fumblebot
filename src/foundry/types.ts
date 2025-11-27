/**
 * Foundry VTT Integration Types
 *
 * Type definitions for FumbleBot <-> Foundry VTT communication
 */

export interface FoundryHealthResponse {
  status: string;
  version: string;
  foundryVersion: string;
  worldId: string;
  worldTitle: string;
  timestamp: string;
}

export interface FoundryChatMessage {
  id: string;
  content: string;
  speaker: {
    alias: string;
    actor?: string;
  };
  timestamp: number;
  type: number; // 0=OOC, 1=IC, 2=Emote, 3=Whisper, 4=Roll
}

export interface FoundryChatOptions {
  speaker?: {
    alias?: string;
    actor?: string;
  };
  type?: number; // 0=OOC, 1=IC, 2=Emote, 3=Whisper, 4=Roll
  whisper?: string[]; // User IDs to whisper to
}

export interface FoundryActor {
  id: string;
  name: string;
  type: string; // "character", "npc", etc.
  img?: string;
  data: any; // System-specific actor data
}

export interface FoundryScene {
  id: string;
  name: string;
  active: boolean;
  background?: string;
  width: number;
  height: number;
}

export interface FoundryCombat {
  id: string;
  active: boolean;
  round: number;
  turn: number;
  combatants: FoundryCombatant[];
}

export interface FoundryCombatant {
  id: string;
  name: string;
  actorId?: string;
  initiative?: number;
  hp?: { value: number; max: number };
}

export interface FoundryRollResult {
  formula: string;
  total: number;
  terms: any[];
  dice: any[];
}

export interface FoundryClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

export type FoundryAccessLevel = 'observer' | 'player' | 'gm_assistant';

// TODO: Phase 1 - Expand these types as we implement more features
