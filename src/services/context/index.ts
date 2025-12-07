/**
 * Context & Memory System
 * Hierarchical Discord structure cache for AI context
 */

export { GuildContextManager } from './guild-context-manager.js'
export { MessageCacheService } from './message-cache.js'
export { ContextNavigator } from './navigator.js'
export * from './types.js'

// Game system detection
export {
  detectGameSystem,
  detectSystemSwitch,
  extractTopics,
  getSystemDisplayName,
  getSupportedSystems,
  type DetectionResult,
} from './game-system-detector.js'
