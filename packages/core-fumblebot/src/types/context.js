/**
 * Context & Memory System Types
 * Hierarchical Discord structure cache for AI context
 *
 * This module provides types for FumbleBot's memory tier system:
 * - HOT: Active context, immediately available
 * - WARM: Recent messages, quick to access
 * - COLD: Summarized/archived, needs retrieval
 */
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * Generate Discord message link from IDs
 * @param guildId Discord guild ID
 * @param channelId Discord channel ID
 * @param messageId Discord message ID
 * @returns Full Discord message URL
 */
export function getMessageLink(guildId, channelId, messageId) {
    return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}
/**
 * Default context manager configuration
 */
export const DEFAULT_CONTEXT_CONFIG = {
    pollIntervalMs: 10 * 60 * 1000, // 10 minutes
    maxMessagesPerChannel: 50,
    maxHotMessages: 10,
    warmToHotThreshold: 5,
    summarizeAfterMessages: 100,
    enableAutoPolling: true,
};
/**
 * Map of game system IDs to display names
 */
export const GAME_SYSTEM_NAMES = {
    '5e': 'D&D 5th Edition',
    'pf2e': 'Pathfinder 2nd Edition',
    'pf1e': 'Pathfinder 1st Edition',
    'cypher': 'Cypher System',
    'bitd': 'Blades in the Dark',
    'swn': 'Stars Without Number',
    'mothership': 'Mothership',
    'coc': 'Call of Cthulhu',
    'fate': 'Fate Core',
    'pbta': 'Powered by the Apocalypse',
    'savage': 'Savage Worlds',
    'dcc': 'Dungeon Crawl Classics',
    'osr': 'Old School Renaissance',
    'other': 'Other System',
};
//# sourceMappingURL=context.js.map