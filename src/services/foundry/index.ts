/**
 * Foundry VTT Services
 * Local utilities for Foundry VTT integration
 */

export { getScreenshotService } from './screenshot.js';
export { FoundryClient, type FoundryClientConfig } from './client.js';
export {
  fetchAndParseManifest,
  isValidManifestUrl,
  SEED_MANIFESTS,
  type FoundryManifest,
} from './manifest.js';
