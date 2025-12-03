/**
 * Web Services Module
 * Provides controlled web fetching for TTRPG content
 */

export {
  WebFetchService,
  webFetchService,
  fetchWebContent,
  search5eTools,
  isUrlAllowed,
  ALLOWED_DOMAINS,
  type WebFetchResult,
  type WebFetchOptions,
} from './fetch.js';

export {
  extractContent,
  type SiteType,
  type ExtractedContent,
} from './extractors.js';

export {
  WebScreenshotService,
  getWebScreenshotService,
  type WebScreenshotOptions,
  type WebScreenshotResult,
} from './screenshot.js';
