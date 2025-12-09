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

/** Adventure (MUD-style text adventure) tool definitions */
export const adventureTools: Tool[] = [
  {
    name: 'adventure_create',
    description: 'Create a new MUD-style text adventure session in a channel. Use when players want to start a text-based adventure game.',
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
        name: {
          type: 'string',
          description: 'Name of the adventure',
        },
        description: {
          type: 'string',
          description: 'Description of the adventure scenario',
        },
      },
      required: ['guildId', 'channelId', 'name'],
    },
  },
  {
    name: 'adventure_join',
    description: 'Join an existing adventure session as a player, DM, or bot.',
    inputSchema: {
      type: 'object',
      properties: {
        adventureId: {
          type: 'string',
          description: 'Adventure ID to join',
        },
        playerId: {
          type: 'string',
          description: 'Discord user ID of the player',
        },
        playerName: {
          type: 'string',
          description: 'Character or display name for the player',
        },
        role: {
          type: 'string',
          description: 'Role in the adventure',
          enum: ['player', 'dm', 'bot'],
          default: 'player',
        },
      },
      required: ['adventureId', 'playerId', 'playerName'],
    },
  },
  {
    name: 'adventure_action',
    description: 'Send an action in the adventure (e.g., "opens the door carefully"). Use for player actions.',
    inputSchema: {
      type: 'object',
      properties: {
        adventureId: {
          type: 'string',
          description: 'Adventure ID',
        },
        playerId: {
          type: 'string',
          description: 'Player sending the action',
        },
        content: {
          type: 'string',
          description: 'The action to perform',
        },
      },
      required: ['adventureId', 'playerId', 'content'],
    },
  },
  {
    name: 'adventure_say',
    description: 'Send dialogue in the adventure (e.g., "Hello there!"). Use when characters speak.',
    inputSchema: {
      type: 'object',
      properties: {
        adventureId: {
          type: 'string',
          description: 'Adventure ID',
        },
        playerId: {
          type: 'string',
          description: 'Player speaking',
        },
        content: {
          type: 'string',
          description: 'What to say',
        },
      },
      required: ['adventureId', 'playerId', 'content'],
    },
  },
  {
    name: 'adventure_emote',
    description: 'Send an emote in the adventure (e.g., "smiles warmly"). Use for expressing emotions or actions.',
    inputSchema: {
      type: 'object',
      properties: {
        adventureId: {
          type: 'string',
          description: 'Adventure ID',
        },
        playerId: {
          type: 'string',
          description: 'Player emoting',
        },
        content: {
          type: 'string',
          description: 'The emote/expression',
        },
      },
      required: ['adventureId', 'playerId', 'content'],
    },
  },
  {
    name: 'adventure_narrative',
    description: 'Send narrative/description text (DM/bot only). Use for setting scenes or describing events.',
    inputSchema: {
      type: 'object',
      properties: {
        adventureId: {
          type: 'string',
          description: 'Adventure ID',
        },
        playerId: {
          type: 'string',
          description: 'DM or bot sending narrative',
        },
        content: {
          type: 'string',
          description: 'Narrative text',
        },
      },
      required: ['adventureId', 'playerId', 'content'],
    },
  },
  {
    name: 'adventure_status',
    description: 'Get status of an adventure by channel or ID.',
    inputSchema: {
      type: 'object',
      properties: {
        guildId: {
          type: 'string',
          description: 'Discord guild ID (if looking up by channel)',
        },
        channelId: {
          type: 'string',
          description: 'Discord channel ID (if looking up by channel)',
        },
        adventureId: {
          type: 'string',
          description: 'Adventure ID (if looking up directly)',
        },
      },
    },
  },
  {
    name: 'adventure_history',
    description: 'Get recent message history from an adventure session.',
    inputSchema: {
      type: 'object',
      properties: {
        adventureId: {
          type: 'string',
          description: 'Adventure ID',
        },
        limit: {
          type: 'number',
          description: 'Number of messages to retrieve',
          default: 20,
        },
      },
      required: ['adventureId'],
    },
  },
  {
    name: 'adventure_end',
    description: 'End an adventure session.',
    inputSchema: {
      type: 'object',
      properties: {
        adventureId: {
          type: 'string',
          description: 'Adventure ID to end',
        },
      },
      required: ['adventureId'],
    },
  },
  {
    name: 'adventure_list',
    description: 'List all active adventure sessions.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

/** FumbleBot utility tool definitions */
export const fumbleTools: Tool[] = [
  {
    name: 'fumble_roll_dice',
    description:
      'Roll dice using standard notation. Supports: basic (2d6+3), advantage (2d20kh), disadvantage (2d20kl), drop lowest (4d6dl), exploding (1d6!), and more. Detects crits and fumbles on d20s.',
    inputSchema: {
      type: 'object',
      properties: {
        notation: {
          type: 'string',
          description: 'Dice notation. Examples: 2d6+3, 2d20kh (advantage), 2d20kl (disadvantage), 4d6dl (drop lowest), 1d6! (exploding)',
        },
        label: {
          type: 'string',
          description: 'Optional label for the roll (e.g., "Attack Roll", "Fireball damage")',
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
    name: 'web_search_fandom_wiki',
    description:
      'Search TTRPG Fandom wikis for campaign setting lore, characters, locations, deities, items, and world-building content. Supports: Forgotten Realms, Eberron, Critical Role/Exandria, Pathfinder/Golarion, Dragonlance, Greyhawk, Spelljammer, Planescape, Ravenloft.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (e.g., "Katokoro Glacier", "Sharn", "Vox Machina", "Absalom")',
        },
        wiki: {
          type: 'string',
          description: 'Which wiki to search',
          enum: ['forgotten-realms', 'eberron', 'critical-role', 'pathfinder', 'dragonlance', 'greyhawk', 'spelljammer', 'planescape', 'ravenloft'],
          default: 'forgotten-realms',
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

/** Persona & Memory tool definitions */
export const personaTools: Tool[] = [
  {
    name: 'memory_remember',
    description:
      'Remember a fact, preference, or piece of information for future reference. Use this to learn from conversations and retain useful context.',
    inputSchema: {
      type: 'object',
      properties: {
        guildId: {
          type: 'string',
          description: 'Discord guild ID (optional, for guild-specific memories)',
        },
        type: {
          type: 'string',
          description: 'Type of memory',
          enum: ['fact', 'preference', 'correction', 'skill'],
          default: 'fact',
        },
        category: {
          type: 'string',
          description: 'Category for organizing memories (e.g., "campaign", "player", "rules")',
          default: 'general',
        },
        key: {
          type: 'string',
          description: 'Unique key/topic for this memory (e.g., "player_bob_character", "house_rule_crits")',
        },
        content: {
          type: 'string',
          description: 'The information to remember',
        },
        confidence: {
          type: 'number',
          description: 'Confidence level 0-1 (default 1.0)',
          default: 1.0,
        },
      },
      required: ['key', 'content'],
    },
  },
  {
    name: 'memory_recall',
    description:
      'Recall memories related to a topic, category, or type. Use this to retrieve previously learned information.',
    inputSchema: {
      type: 'object',
      properties: {
        guildId: {
          type: 'string',
          description: 'Discord guild ID to filter memories',
        },
        type: {
          type: 'string',
          description: 'Filter by memory type',
          enum: ['fact', 'preference', 'correction', 'skill'],
        },
        category: {
          type: 'string',
          description: 'Filter by category',
        },
        key: {
          type: 'string',
          description: 'Search for memories containing this key/topic',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of memories to return',
          default: 10,
        },
      },
    },
  },
  {
    name: 'memory_forget',
    description:
      'Forget/delete a specific memory. Use when information is outdated or incorrect.',
    inputSchema: {
      type: 'object',
      properties: {
        guildId: {
          type: 'string',
          description: 'Discord guild ID',
        },
        type: {
          type: 'string',
          description: 'Memory type',
        },
        key: {
          type: 'string',
          description: 'Memory key to forget',
        },
      },
      required: ['guildId', 'type', 'key'],
    },
  },
  {
    name: 'skill_learn',
    description:
      'Learn a new skill or capability. Use when discovering you can do something new.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'Unique identifier for the skill (lowercase, hyphenated)',
        },
        name: {
          type: 'string',
          description: 'Human-readable skill name',
        },
        description: {
          type: 'string',
          description: 'What this skill does',
        },
        category: {
          type: 'string',
          description: 'Skill category',
          enum: ['knowledge', 'tools', 'roleplay', 'general'],
          default: 'general',
        },
        toolName: {
          type: 'string',
          description: 'Associated MCP tool name (if any)',
        },
        personaSlug: {
          type: 'string',
          description: 'Persona to attach this skill to',
          default: 'fumblebot',
        },
      },
      required: ['slug', 'name'],
    },
  },
  {
    name: 'persona_list',
    description:
      'List available personas/characters that can be used.',
    inputSchema: {
      type: 'object',
      properties: {
        guildId: {
          type: 'string',
          description: 'Discord guild ID to include guild-specific personas',
        },
      },
    },
  },
  {
    name: 'persona_get',
    description:
      'Get details about a specific persona including skills and configuration.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'Persona slug (e.g., "fumblebot", "dm", "tavern-keeper")',
        },
      },
      required: ['slug'],
    },
  },
  {
    name: 'persona_context',
    description:
      'Get the full context for a persona including personality, skills, and relevant memories.',
    inputSchema: {
      type: 'object',
      properties: {
        personaSlug: {
          type: 'string',
          description: 'Persona slug',
          default: 'fumblebot',
        },
        guildId: {
          type: 'string',
          description: 'Guild ID for guild-specific memories',
        },
      },
    },
  },
];

/** Get all tool definitions */
export function getAllTools(): Tool[] {
  return [
    ...foundryTools,
    ...foundryContainerTools,
    ...aiTools,
    ...adventureTools,
    ...fumbleTools,
    ...voiceTools,
    ...kbTools,
    ...webTools,
    ...worldAnvilTools,
    ...personaTools,
  ];
}
