/**
 * MCP Tool Definitions
 * All tool schemas for the FumbleBot MCP server
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/** Foundry VTT tool definitions */
export const foundryTools: Tool[] = [
  {
    name: 'foundry_health_check',
    description:
      'Check if Foundry VTT instance is running and accessible. Returns status information.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'foundry_screenshot',
    description:
      'Capture a screenshot of the Foundry VTT instance. Use when asked to see what\'s happening in the game.',
    inputSchema: {
      type: 'object',
      properties: {
        fullPage: {
          type: 'boolean',
          description: 'Capture full scrollable page',
          default: false,
        },
      },
    },
  },
  {
    name: 'foundry_screenshot_canvas',
    description:
      'Capture screenshot of just the game canvas/board (tokens and maps).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'foundry_get_chat',
    description: 'Retrieve recent chat messages from Foundry VTT.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of messages to retrieve',
          default: 10,
        },
      },
    },
  },
  {
    name: 'foundry_send_chat',
    description: 'Send a chat message to Foundry VTT as the bot.',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to send',
        },
        type: {
          type: 'string',
          description: 'Message type',
          enum: ['ooc', 'ic', 'emote', 'whisper'],
          default: 'ooc',
        },
      },
      required: ['message'],
    },
  },
];

/** Foundry Container management tool definitions */
export const foundryContainerTools: Tool[] = [
  {
    name: 'foundry_create_container',
    description:
      'Create a new FoundryVTT container instance for a game session. Use when GM wants to start Foundry for their campaign.',
    inputSchema: {
      type: 'object',
      properties: {
        guildId: {
          type: 'string',
          description: 'Discord guild ID',
        },
        campaignId: {
          type: 'string',
          description: 'Campaign ID (optional)',
        },
        worldName: {
          type: 'string',
          description: 'World/campaign name for the Foundry instance',
        },
        foundryVersion: {
          type: 'string',
          description: 'Foundry version (e.g., "12", "11")',
          default: '12',
        },
        maxIdleMinutes: {
          type: 'number',
          description: 'Auto-stop after this many idle minutes',
          default: 120,
        },
      },
      required: ['guildId'],
    },
  },
  {
    name: 'foundry_list_containers',
    description:
      'List all active FoundryVTT containers for the current user. Shows running instances and their status.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'foundry_list_guild_containers',
    description:
      'List all FoundryVTT containers for a specific guild/server. GMs can see all running instances for their server.',
    inputSchema: {
      type: 'object',
      properties: {
        guildId: {
          type: 'string',
          description: 'Discord guild ID',
        },
      },
      required: ['guildId'],
    },
  },
  {
    name: 'foundry_get_container',
    description:
      'Get details about a specific FoundryVTT container, including status, access URL, and runtime info.',
    inputSchema: {
      type: 'object',
      properties: {
        containerId: {
          type: 'string',
          description: 'Container ID',
        },
      },
      required: ['containerId'],
    },
  },
  {
    name: 'foundry_stop_container',
    description:
      'Stop a running FoundryVTT container. Use when game session is over to free resources.',
    inputSchema: {
      type: 'object',
      properties: {
        containerId: {
          type: 'string',
          description: 'Container ID to stop',
        },
      },
      required: ['containerId'],
    },
  },
];

/** AI tool definitions (Anthropic & OpenAI) */
export const aiTools: Tool[] = [
  // Anthropic (Claude)
  {
    name: 'anthropic_chat',
    description:
      'Chat with Claude (Sonnet or Haiku). Use for general AI assistance, creative writing, analysis, DM responses, NPC generation.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The message to send to Claude',
        },
        model: {
          type: 'string',
          description: 'Claude model to use',
          enum: ['sonnet', 'haiku'],
          default: 'sonnet',
        },
        systemPrompt: {
          type: 'string',
          description: 'Optional system prompt to guide Claude',
        },
        temperature: {
          type: 'number',
          description: 'Creativity/randomness (0.0 to 1.0)',
          default: 0.7,
        },
        maxTokens: {
          type: 'number',
          description: 'Maximum tokens in response',
          default: 2048,
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'anthropic_dm_response',
    description:
      'Generate a Dungeon Master response for TTRPG scenarios using Claude. Includes vivid descriptions and suggests dice rolls.',
    inputSchema: {
      type: 'object',
      properties: {
        scenario: {
          type: 'string',
          description: 'The scenario or player action to respond to',
        },
        system: {
          type: 'string',
          description: 'Game system (e.g., "5e", "Pathfinder 2e", "Cypher")',
          default: '5e',
        },
        tone: {
          type: 'string',
          description: 'Response tone',
          enum: ['dramatic', 'humorous', 'serious', 'dark'],
          default: 'dramatic',
        },
      },
      required: ['scenario'],
    },
  },
  {
    name: 'anthropic_lookup_rule',
    description:
      'Look up TTRPG rules using Claude Haiku (fast, accurate). Returns concise rule explanations.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The rule question to answer',
        },
        system: {
          type: 'string',
          description: 'Game system',
          default: '5e',
        },
      },
      required: ['query'],
    },
  },
  // OpenAI (GPT)
  {
    name: 'openai_chat',
    description:
      'Chat with OpenAI GPT-4o. Use for complex content generation, function calling, structured output.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt/message to send to the model',
        },
        systemPrompt: {
          type: 'string',
          description: 'Optional system prompt to guide the model',
        },
        temperature: {
          type: 'number',
          description: 'Creativity/randomness (0.0 to 2.0)',
          default: 0.7,
        },
        maxTokens: {
          type: 'number',
          description: 'Maximum tokens in response',
          default: 2048,
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'openai_generate_dungeon',
    description:
      'Generate a TTRPG dungeon with structured rooms, encounters, and treasure using OpenAI function calling.',
    inputSchema: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          description: 'Dungeon theme (e.g., "undead crypt", "dwarven mine")',
        },
        size: {
          type: 'string',
          enum: ['small', 'medium', 'large'],
          description: 'Dungeon size',
          default: 'medium',
        },
        level: {
          type: 'number',
          description: 'Party level (for encounter balancing)',
        },
        style: {
          type: 'string',
          description: 'Optional style (e.g., "linear", "branching", "sandbox")',
        },
      },
      required: ['theme', 'level'],
    },
  },
  {
    name: 'openai_generate_encounter',
    description:
      'Generate a TTRPG combat encounter with enemies, terrain, and rewards using OpenAI.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Encounter type (e.g., "combat", "social", "exploration")',
          default: 'combat',
        },
        difficulty: {
          type: 'string',
          enum: ['easy', 'medium', 'hard', 'deadly'],
          description: 'Encounter difficulty',
          default: 'medium',
        },
        partyLevel: {
          type: 'number',
          description: 'Average party level',
        },
        partySize: {
          type: 'number',
          description: 'Number of players',
        },
        environment: {
          type: 'string',
          description: 'Optional environment (e.g., "forest", "dungeon")',
        },
      },
      required: ['partyLevel', 'partySize'],
    },
  },
];

/** Container (adventure terminal) tool definitions */
export const containerTools: Tool[] = [
  {
    name: 'container_start',
    description: 'Start an adventure terminal container for a guild/channel. Required before executing commands.',
    inputSchema: {
      type: 'object',
      properties: {
        guildId: {
          type: 'string',
          description: 'Discord guild ID',
        },
        channelId: {
          type: 'string',
          description: 'Discord channel ID',
        },
        userId: {
          type: 'string',
          description: 'Discord user ID',
        },
        userName: {
          type: 'string',
          description: 'Username for container prompt',
        },
      },
      required: ['guildId', 'channelId', 'userId'],
    },
  },
  {
    name: 'container_stop',
    description: 'Stop a running container for a guild/channel.',
    inputSchema: {
      type: 'object',
      properties: {
        guildId: {
          type: 'string',
          description: 'Discord guild ID',
        },
        channelId: {
          type: 'string',
          description: 'Discord channel ID',
        },
        userId: {
          type: 'string',
          description: 'Discord user ID',
        },
      },
      required: ['guildId', 'channelId', 'userId'],
    },
  },
  {
    name: 'container_status',
    description: 'Get status of a container for a guild/channel.',
    inputSchema: {
      type: 'object',
      properties: {
        guildId: {
          type: 'string',
          description: 'Discord guild ID',
        },
        channelId: {
          type: 'string',
          description: 'Discord channel ID',
        },
        userId: {
          type: 'string',
          description: 'Discord user ID',
        },
      },
      required: ['guildId', 'channelId', 'userId'],
    },
  },
  {
    name: 'container_exec',
    description: 'Execute a command in a container and get output. Useful for installing games/mods or running shell commands.',
    inputSchema: {
      type: 'object',
      properties: {
        guildId: {
          type: 'string',
          description: 'Discord guild ID',
        },
        channelId: {
          type: 'string',
          description: 'Discord channel ID',
        },
        userId: {
          type: 'string',
          description: 'Discord user ID',
        },
        command: {
          type: 'string',
          description: 'Shell command to execute',
        },
        timeout: {
          type: 'number',
          description: 'Command timeout in milliseconds',
          default: 30000,
        },
      },
      required: ['guildId', 'channelId', 'userId', 'command'],
    },
  },
];

/** FumbleBot utility tool definitions */
export const fumbleTools: Tool[] = [
  {
    name: 'fumble_roll_dice',
    description:
      'Roll dice using standard notation (e.g., "2d6+3", "1d20", "4d6 drop lowest"). Returns individual rolls and total.',
    inputSchema: {
      type: 'object',
      properties: {
        notation: {
          type: 'string',
          description: 'Dice notation (e.g., "2d6+3", "1d20")',
        },
        label: {
          type: 'string',
          description: 'Optional label for the roll',
        },
      },
      required: ['notation'],
    },
  },
  {
    name: 'fumble_generate_npc',
    description:
      'Generate a TTRPG NPC with name, backstory, personality, and stats. Use when DM needs a quick NPC.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'NPC type or role',
          default: 'random',
        },
        system: {
          type: 'string',
          description: 'Game system (e.g., "5e", "Pathfinder 2e", "Cypher")',
          default: '5e',
        },
      },
    },
  },
  {
    name: 'fumble_generate_lore',
    description:
      'Generate world-building lore (locations, items, factions, etc.). Use for campaign content.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'What to generate lore about',
        },
        style: {
          type: 'string',
          description: 'Writing style',
          enum: ['chronicle', 'legend', 'scholarly', 'tavern'],
          default: 'chronicle',
        },
      },
      required: ['topic'],
    },
  },
];

/** Voice control tool definitions */
export const voiceTools: Tool[] = [
  {
    name: 'fumble_join_voice_assistant',
    description:
      'Join a Discord voice channel as an AI assistant. FumbleBot will listen for wake words ("Hey FumbleBot") and respond to voice commands like dice rolls and rule lookups. Use when users want to interact with FumbleBot via voice.',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: {
          type: 'string',
          description: 'Discord voice channel ID to join',
        },
        guildId: {
          type: 'string',
          description: 'Discord guild/server ID',
        },
      },
      required: ['channelId', 'guildId'],
    },
  },
  {
    name: 'fumble_join_voice_transcribe',
    description:
      'Join a Discord voice channel to transcribe the conversation. Records all speech and creates a session transcript. Use when users want to take notes or record a session.',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: {
          type: 'string',
          description: 'Discord voice channel ID to join',
        },
        guildId: {
          type: 'string',
          description: 'Discord guild/server ID',
        },
      },
      required: ['channelId', 'guildId'],
    },
  },
  {
    name: 'fumble_stop_assistant',
    description:
      'Stop the voice assistant and leave the voice channel. Use when users are done using voice commands.',
    inputSchema: {
      type: 'object',
      properties: {
        guildId: {
          type: 'string',
          description: 'Discord guild/server ID',
        },
      },
      required: ['guildId'],
    },
  },
  {
    name: 'fumble_stop_transcribe',
    description:
      'Stop transcription, leave the voice channel, and send the transcript to the requesting user via DM. Use when users are done recording the session.',
    inputSchema: {
      type: 'object',
      properties: {
        guildId: {
          type: 'string',
          description: 'Discord guild/server ID',
        },
        userId: {
          type: 'string',
          description: 'Discord user ID to DM the transcript to',
        },
      },
      required: ['guildId', 'userId'],
    },
  },
  {
    name: 'fumble_get_voice_status',
    description:
      'Get the current voice session status for a guild. Returns whether FumbleBot is in a voice channel and what mode it is in (assistant or transcribe).',
    inputSchema: {
      type: 'object',
      properties: {
        guildId: {
          type: 'string',
          description: 'Discord guild/server ID',
        },
      },
      required: ['guildId'],
    },
  },
  {
    name: 'fumble_set_voice',
    description:
      'Change FumbleBot\'s TTS voice. Available voices: orion (male narrator, default), luna (female, warm), zeus (male, deep), athena (female, authoritative), perseus (male, heroic), angus (male, Scottish), stella (female, bright).',
    inputSchema: {
      type: 'object',
      properties: {
        voice: {
          type: 'string',
          description: 'Voice to use',
          enum: ['orion', 'luna', 'zeus', 'athena', 'perseus', 'angus', 'stella'],
          default: 'orion',
        },
        guildId: {
          type: 'string',
          description: 'Discord guild/server ID (optional, applies to current session)',
        },
      },
      required: ['voice'],
    },
  },
  {
    name: 'fumble_assume_role',
    description:
      'Have FumbleBot assume an NPC role/character for roleplay. FumbleBot will speak in character until the role is cleared. Great for DM-controlled NPCs during sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'NPC name (e.g., "Gundren Rockseeker", "Bartender Bob")',
        },
        voice: {
          type: 'string',
          description: 'Voice to use for this character',
          enum: ['orion', 'luna', 'zeus', 'athena', 'perseus', 'angus', 'stella'],
        },
        personality: {
          type: 'string',
          description: 'Brief personality description (e.g., "gruff dwarf merchant", "nervous halfling innkeeper")',
        },
        guildId: {
          type: 'string',
          description: 'Discord guild/server ID',
        },
      },
      required: ['name', 'guildId'],
    },
  },
  {
    name: 'fumble_clear_role',
    description:
      'Clear the current NPC role and return to default FumbleBot persona.',
    inputSchema: {
      type: 'object',
      properties: {
        guildId: {
          type: 'string',
          description: 'Discord guild/server ID',
        },
      },
      required: ['guildId'],
    },
  },
  {
    name: 'fumble_list_voices',
    description:
      'List all available TTS voices with descriptions.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

/** Knowledge Base tool definitions */
export const kbTools: Tool[] = [
  {
    name: 'kb_search',
    description:
      'Search the TTRPG Knowledge Base for rules, references, and guides. Use when you need to look up game mechanics, spell descriptions, FoundryVTT API docs, or other TTRPG information.',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Search query (keywords to search for)',
        },
        system: {
          type: 'string',
          description: 'Filter by game system (e.g., "dnd5e", "cypher", "foundry")',
        },
        category: {
          type: 'string',
          description: 'Filter by category (e.g., "rules", "api", "user-guide")',
        },
        tags: {
          type: 'string',
          description: 'Filter by tags (comma-separated)',
        },
      },
      required: ['search'],
    },
  },
  {
    name: 'kb_get_article',
    description:
      'Get a specific Knowledge Base article by its slug. Returns full article content in markdown format.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'Article slug (e.g., "common/dice-notation", "dnd5e/spellcasting", "foundry/api-basics")',
        },
      },
      required: ['slug'],
    },
  },
  {
    name: 'kb_list_systems',
    description:
      'List all available game systems in the Knowledge Base (e.g., dnd5e, cypher, foundry, pc-games).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'kb_list_articles',
    description:
      'List all Knowledge Base articles with optional filters. Returns article metadata (titles, systems, categories) without full content.',
    inputSchema: {
      type: 'object',
      properties: {
        system: {
          type: 'string',
          description: 'Filter by game system',
        },
        category: {
          type: 'string',
          description: 'Filter by category',
        },
        tags: {
          type: 'string',
          description: 'Filter by tags (comma-separated)',
        },
      },
    },
  },
];

/** Web fetch tool definitions */
export const webTools: Tool[] = [
  {
    name: 'web_fetch',
    description:
      'Fetch content from external TTRPG websites for reference. Supports 5e.tools, D&D Beyond, FoundryVTT KB, Cypher tools, and other TTRPG resources. Use when you have a specific URL.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Full URL to fetch (e.g., "https://5e.tools/spells.html#fireball", "https://foundryvtt.com/kb/article/actors/")',
        },
        query: {
          type: 'string',
          description: 'What information to extract from the page (e.g., "spell description", "actor API methods", "dice rolling rules")',
        },
        site: {
          type: 'string',
          description: 'Site type for better parsing',
          enum: ['5e.tools', 'dndbeyond', 'foundryvtt-kb', 'cypher', 'general'],
          default: 'general',
        },
      },
      required: ['url', 'query'],
    },
  },
  {
    name: 'web_search_cypher_srd',
    description:
      'Search Old Gus\' Cypher System SRD (https://callmepartario.github.io/og-csrd/) for Cypher System rules, abilities, types, descriptors, foci, cyphers, and more. Returns formatted content with stats and descriptions.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (e.g., "warrior", "bears a halo of fire", "onslaught", "cypher")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_search_5etools',
    description:
      'Search 5e.tools for 5e spells, items, monsters, classes, races, feats, etc. Returns formatted content with stats and descriptions. Faster than web_fetch when you don\'t have a specific URL.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (e.g., "fireball", "goblin", "longsword", "wizard")',
        },
        category: {
          type: 'string',
          description: 'Content category to search',
          enum: ['spells', 'items', 'bestiary', 'classes', 'races', 'feats', 'backgrounds', 'conditions', 'actions'],
          default: 'spells',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_search_forgotten_realms',
    description:
      'Search the Forgotten Realms Wiki for fantasy lore, characters, locations, deities, items, and more. Returns formatted content about the Forgotten Realms campaign setting.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (e.g., "Drizzt", "Waterdeep", "Mystra", "Baldur\'s Gate", "Zhentarim")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_search_dndbeyond_support',
    description:
      'Search D&D Beyond Support for help articles, troubleshooting, and FAQ. Use when players have issues with D&D Beyond accounts, character sheets, purchases, or technical problems.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (e.g., "reset password", "character not loading", "share content", "subscription", "import character")',
        },
      },
      required: ['query'],
    },
  },
];

/** World Anvil tool definitions */
export const worldAnvilTools: Tool[] = [
  {
    name: 'worldanvil_list_worlds',
    description:
      'List all World Anvil worlds accessible to the current user. Returns world names, descriptions, and IDs.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'worldanvil_get_world',
    description:
      'Get detailed information about a specific World Anvil world including description, genres, and metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        worldId: {
          type: 'string',
          description: 'World Anvil world ID',
        },
      },
      required: ['worldId'],
    },
  },
  {
    name: 'worldanvil_search_articles',
    description:
      'Search for articles in a World Anvil world by title or content. Returns matching articles with summaries. Use for looking up custom campaign lore, NPCs, locations, items, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        worldId: {
          type: 'string',
          description: 'World Anvil world ID to search in',
        },
        query: {
          type: 'string',
          description: 'Search query (article title or keywords)',
        },
      },
      required: ['worldId', 'query'],
    },
  },
  {
    name: 'worldanvil_get_article',
    description:
      'Get full content of a specific World Anvil article by ID. Returns title, content, tags, and related articles.',
    inputSchema: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: 'World Anvil article ID',
        },
      },
      required: ['articleId'],
    },
  },
  {
    name: 'worldanvil_list_articles',
    description:
      'List all articles in a World Anvil world. Returns article titles, types, and IDs for browsing.',
    inputSchema: {
      type: 'object',
      properties: {
        worldId: {
          type: 'string',
          description: 'World Anvil world ID',
        },
      },
      required: ['worldId'],
    },
  },
  {
    name: 'worldanvil_list_categories',
    description:
      'List all categories in a World Anvil world. Categories organize articles by type (locations, characters, items, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        worldId: {
          type: 'string',
          description: 'World Anvil world ID',
        },
      },
      required: ['worldId'],
    },
  },
];

/** Get all tool definitions */
export function getAllTools(): Tool[] {
  return [
    ...foundryTools,
    ...foundryContainerTools,
    ...aiTools,
    ...containerTools,
    ...fumbleTools,
    ...voiceTools,
    ...kbTools,
    ...webTools,
    ...worldAnvilTools,
  ];
}
