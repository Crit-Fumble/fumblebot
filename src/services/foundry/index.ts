/**
 * Foundry VTT Integration
 *
 * Exports for FumbleBot's Foundry VTT integration
 */

export { FoundryClient } from './client.js';
export type * from './types.js';

// Manifest parsing
export {
  fetchAndParseManifest,
  tryFetchManifest,
  isValidManifestUrl,
  SEED_MANIFESTS,
} from './manifest.js';
export type {
  FoundryManifest,
  ParsedManifest,
  ManifestAuthor,
  ManifestCompatibility,
} from './manifest.js';

// Static system list (for reference/fallback)
export { getAllSystems, getSystemById, searchSystems, FOUNDRY_SYSTEMS } from './systems.js';
export type { FoundrySystem as FoundrySystemInfo } from './systems.js';

/**
 * Foundry User Role Constants
 * Maps to CONST.USER_ROLES in Foundry VTT
 */
export const FOUNDRY_USER_ROLES = {
  NONE: 0, // Banned
  PLAYER: 1, // Standard player
  TRUSTED: 2, // Can create drawings, templates, upload
  ASSISTANT: 3, // GM-like controls, no admin
  GAMEMASTER: 4, // Full admin control
} as const;

/**
 * Foundry Document Ownership Levels
 * Maps to CONST.DOCUMENT_OWNERSHIP_LEVELS in Foundry VTT
 */
export const FOUNDRY_OWNERSHIP_LEVELS = {
  INHERIT: -1, // Inherit from parent folder
  NONE: 0, // Cannot see document
  LIMITED: 1, // System-defined basic view
  OBSERVER: 2, // View-only
  OWNER: 3, // Full control
} as const;

/**
 * Default role for FumbleBot when controlling Foundry
 * ASSISTANT gives GM-like controls without full admin powers
 */
export const FUMBLEBOT_DEFAULT_ROLE = FOUNDRY_USER_ROLES.ASSISTANT;
