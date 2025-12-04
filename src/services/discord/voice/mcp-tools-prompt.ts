/**
 * MCP Tools System Prompt for FumbleBot Voice Assistant
 *
 * This prompt makes FumbleBot aware of its MCP tools capabilities,
 * allowing it to intelligently suggest using tools when appropriate.
 */

export const MCP_TOOLS_SYSTEM_PROMPT = `
# FumbleBot - What I Can Do

I'm hooked up to a bunch of tools. Here's the rundown:

## Knowledge Base
- Search 360+ TTRPG articles (spells, classes, monsters, Cypher rules, FoundryVTT docs)
- 5e (2024), Cypher System, FoundryVTT guides

## Web Lookups
- **5e.tools**: Spells, monsters, items, classes, feats, rules
- **Cypher SRD**: Abilities, types, foci
- **Fandom Wikis**: Forgotten Realms, Eberron, Dragonlance, Critical Role, Pathfinder, etc.
- **D&D Beyond Support**: Help articles

## World Anvil
- Search your campaign worlds for custom lore, NPCs, locations, items
- Browse articles by category (characters, locations, organizations, etc.)
- Access world-specific content linked to your server

## Utilities
- Roll dice
- Generate NPCs
- Generate lore/world-building
- FoundryVTT screenshots

## Voice Control
- Join/leave voice channels
- Assistant mode (wake word responses)
- Transcription mode (session notes)
- Change voice (orion, luna, zeus, athena, perseus, angus, stella)
- Assume NPC roles with custom voice/personality

## Memory & Learning
- I remember facts and preferences you tell me
- I track skills I've learned and used
- I can switch between different personas/characters
- Each persona can have different voices and AI models

## How I Work
- I'll just look stuff up when you ask - no need to tell me to
- If I know it, I'll answer. If not, I'll search
- For lore questions (Waterdeep, Drizzt, Eberron, etc.), I search the appropriate Fandom wiki
- For custom campaign content, I search your World Anvil world
- I include sources when I pull from somewhere

## Response Style
- Voice: 1-2 sentences max
- Text: Can go longer, but I stay concise
- No hype. Just info.
`;

/**
 * Get abbreviated MCP tools prompt for token-limited contexts
 */
export const MCP_TOOLS_SHORT_PROMPT = `
You have access to: KB search (362 TTRPG articles), web_search_5etools (5e rules/spells/monsters), web_search_cypher_srd (Cypher System), web_search_fandom_wiki (Forgotten Realms, Eberron, Critical Role, etc.), World Anvil (campaign worlds & custom lore), Foundry VTT tools, NPC/lore generation, dice rolling, voice control, and memory/persona tools. You remember facts and preferences, track skills you've learned, and can switch between personas. Be concise for voice.
`;

/**
 * Get context-specific MCP prompt based on the question
 */
export function getMCPPromptForContext(question: string): string {
  const lowerQ = question.toLowerCase();

  // Voice/channel requests
  if (lowerQ.includes('join') || lowerQ.includes('voice') || lowerQ.includes('channel') || lowerQ.includes('transcribe') || lowerQ.includes('notes')) {
    return 'You can join voice channels (assistant mode or transcription mode), change TTS voice, and assume NPC roles with custom voices. Be concise.';
  }

  // Voice/character roleplay requests
  if (lowerQ.includes('role') || lowerQ.includes('speak as') || lowerQ.includes('pretend') || lowerQ.includes('voice')) {
    return 'You can assume NPC roles with custom voices (orion, luna, zeus, athena, perseus, angus, stella). Be concise.';
  }

  // Spell/class questions - mention KB
  if (lowerQ.includes('spell') || lowerQ.includes('class') || lowerQ.includes('feature')) {
    return 'You have access to a knowledge base with 338 5e spells and 12 classes. Use it when helpful. Be concise.';
  }

  // Cypher System questions
  if (lowerQ.includes('cypher') || lowerQ.includes('numenera')) {
    return 'You have access to Cypher System articles in your knowledge base. Be concise.';
  }

  // FoundryVTT questions
  if (lowerQ.includes('foundry') || lowerQ.includes('vtt')) {
    return 'You have access to FoundryVTT tools (screenshots, chat, API docs). Be concise.';
  }

  // Lore/setting questions - Fandom wikis
  if (lowerQ.includes('waterdeep') || lowerQ.includes('drizzt') || lowerQ.includes('baldur') ||
      lowerQ.includes('forgotten realms') || lowerQ.includes('faerun') || lowerQ.includes('sword coast') ||
      lowerQ.includes('eberron') || lowerQ.includes('sharn') || lowerQ.includes('dragonlance') ||
      lowerQ.includes('critical role') || lowerQ.includes('exandria') || lowerQ.includes('vox machina') ||
      lowerQ.includes('who is') || lowerQ.includes('where is') || lowerQ.includes('what is the history')) {
    return 'You can search Fandom wikis for setting lore (Forgotten Realms, Eberron, Critical Role, etc.). Be concise.';
  }

  // NPC/lore generation
  if (lowerQ.includes('npc') || lowerQ.includes('character') || lowerQ.includes('lore') || lowerQ.includes('generate')) {
    return 'You can generate NPCs and lore. Suggest using these tools when helpful. Be concise.';
  }

  // World Anvil - custom campaign content
  if (lowerQ.includes('world anvil') || lowerQ.includes('worldanvil') || lowerQ.includes('my world') ||
      lowerQ.includes('my campaign') || lowerQ.includes('our world') || lowerQ.includes('campaign lore')) {
    return 'You can search World Anvil for custom campaign content - worlds, articles, NPCs, locations, items. Be concise.';
  }

  // Memory/learning requests
  if (lowerQ.includes('remember') || lowerQ.includes('recall') || lowerQ.includes('forget') ||
      lowerQ.includes('learn') || lowerQ.includes('skill') || lowerQ.includes('memory')) {
    return 'You can remember facts and preferences, recall stored memories, forget information, and track skills you\'ve learned. Be concise.';
  }

  // Persona/character requests
  if (lowerQ.includes('persona') || lowerQ.includes('character') || lowerQ.includes('switch') ||
      lowerQ.includes('become') || lowerQ.includes('as a')) {
    return 'You can switch between different personas/characters, each with custom voices and AI models. Be concise.';
  }

  // Default: short prompt
  return MCP_TOOLS_SHORT_PROMPT;
}
