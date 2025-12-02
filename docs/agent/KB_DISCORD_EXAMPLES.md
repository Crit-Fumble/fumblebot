# Knowledge Base Discord Command Examples

**Date**: 2025-12-01
**KB Articles**: 362 (338 spells, 12 classes, Cypher content)

## Overview

Now that Core has populated the Knowledge Base with 362 articles, here are examples of how to use the KB in FumbleBot Discord commands.

## Example 1: `/spell` Command

Look up D&D 5e spells from the KB.

**File**: `src/commands/spell.ts`

```typescript
import { SlashCommandBuilder } from 'discord.js';
import { getCoreClient } from '../lib/core-client.js';
import type { CommandHandler } from './types.js';

export const command = new SlashCommandBuilder()
  .setName('spell')
  .setDescription('Look up a D&D 5e spell')
  .addStringOption(option =>
    option
      .setName('name')
      .setDescription('Spell name to search for')
      .setRequired(true)
  );

export const handler: CommandHandler = async (interaction) => {
  const spellName = interaction.options.getString('name', true);

  await interaction.deferReply();

  try {
    const coreClient = getCoreClient();

    // Search for the spell
    const { articles } = await coreClient.kb.list({
      system: 'dnd5e',
      category: 'spells',
      search: spellName
    });

    if (articles.length === 0) {
      await interaction.editReply(`Spell "${spellName}" not found.`);
      return;
    }

    // Get the first match (best match)
    const spellSlug = articles[0].slug;
    const { article } = await coreClient.kb.get(spellSlug);

    // Format spell info for Discord
    const embed = {
      title: article.frontmatter.title,
      description: article.content.substring(0, 2000), // Discord limit
      color: getSpellSchoolColor(article.frontmatter.tags),
      fields: [
        {
          name: 'Level',
          value: getSpellLevel(article.frontmatter.tags),
          inline: true
        },
        {
          name: 'School',
          value: getSpellSchool(article.frontmatter.tags),
          inline: true
        },
        {
          name: 'Classes',
          value: getSpellClasses(article.frontmatter.tags).join(', '),
          inline: false
        }
      ],
      footer: {
        text: 'Source: SRD 5.2.1 CC'
      }
    };

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Spell lookup error:', error);
    await interaction.editReply('Failed to look up spell. KB may not be configured.');
  }
};

// Helper functions
function getSpellLevel(tags: string[]): string {
  const levelTag = tags.find(t => t.startsWith('level-'));
  if (levelTag === 'level-0') return 'Cantrip';
  if (levelTag) return levelTag.replace('level-', 'Level ');
  return 'Unknown';
}

function getSpellSchool(tags: string[]): string {
  const schools = ['abjuration', 'conjuration', 'divination', 'enchantment',
                   'evocation', 'illusion', 'necromancy', 'transmutation'];
  const school = tags.find(t => schools.includes(t));
  return school ? school.charAt(0).toUpperCase() + school.slice(1) : 'Unknown';
}

function getSpellClasses(tags: string[]): string[] {
  const classes = ['bard', 'cleric', 'druid', 'paladin', 'ranger',
                   'sorcerer', 'warlock', 'wizard'];
  return tags.filter(t => classes.includes(t))
    .map(c => c.charAt(0).toUpperCase() + c.slice(1));
}

function getSpellSchoolColor(tags: string[]): number {
  const schoolColors: Record<string, number> = {
    'abjuration': 0x3498db,   // Blue
    'conjuration': 0xe74c3c,  // Red
    'divination': 0x9b59b6,   // Purple
    'enchantment': 0xe91e63,  // Pink
    'evocation': 0xf39c12,    // Orange
    'illusion': 0x1abc9c,     // Teal
    'necromancy': 0x2c3e50,   // Dark gray
    'transmutation': 0x27ae60, // Green
  };

  const school = tags.find(t => t in schoolColors);
  return school ? schoolColors[school] : 0x95a5a6;
}
```

**Usage:**
```
/spell name:fireball
/spell name:cure wounds
/spell name:wish
```

## Example 2: `/class` Command

Look up D&D 5e class information.

**File**: `src/commands/class.ts`

```typescript
import { SlashCommandBuilder } from 'discord.js';
import { getCoreClient } from '../lib/core-client.js';
import type { CommandHandler } from './types.js';

export const command = new SlashCommandBuilder()
  .setName('class')
  .setDescription('Look up a D&D 5e class')
  .addStringOption(option =>
    option
      .setName('name')
      .setDescription('Class name')
      .setRequired(true)
      .addChoices(
        { name: 'Barbarian', value: 'barbarian' },
        { name: 'Bard', value: 'bard' },
        { name: 'Cleric', value: 'cleric' },
        { name: 'Druid', value: 'druid' },
        { name: 'Fighter', value: 'fighter' },
        { name: 'Monk', value: 'monk' },
        { name: 'Paladin', value: 'paladin' },
        { name: 'Ranger', value: 'ranger' },
        { name: 'Rogue', value: 'rogue' },
        { name: 'Sorcerer', value: 'sorcerer' },
        { name: 'Warlock', value: 'warlock' },
        { name: 'Wizard', value: 'wizard' }
      )
  );

export const handler: CommandHandler = async (interaction) => {
  const className = interaction.options.getString('name', true);

  await interaction.deferReply();

  try {
    const coreClient = getCoreClient();

    // Get the class article
    const slug = `dnd5e/classes/class-${className}`;
    const { article } = await coreClient.kb.get(slug);

    // Format class info for Discord
    const embed = {
      title: article.frontmatter.title,
      description: article.content.substring(0, 2000),
      color: getClassColor(className),
      fields: extractClassFeatures(article.content),
      footer: {
        text: 'Source: SRD 5.2.1 CC'
      }
    };

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Class lookup error:', error);
    await interaction.editReply(`Failed to look up ${className} class.`);
  }
};

function getClassColor(className: string): number {
  const colors: Record<string, number> = {
    'barbarian': 0xe74c3c,  // Red
    'bard': 0x9b59b6,       // Purple
    'cleric': 0xf39c12,     // Gold
    'druid': 0x27ae60,      // Green
    'fighter': 0x95a5a6,    // Gray
    'monk': 0x3498db,       // Blue
    'paladin': 0xf1c40f,    // Yellow
    'ranger': 0x16a085,     // Teal
    'rogue': 0x34495e,      // Dark blue
    'sorcerer': 0xe91e63,   // Pink
    'warlock': 0x8e44ad,    // Dark purple
    'wizard': 0x2980b9,     // Light blue
  };
  return colors[className] || 0x95a5a6;
}

function extractClassFeatures(content: string): any[] {
  // Parse markdown content to extract key features
  // This is a simplified example - you'd want more robust parsing
  const features = [];

  // Extract Hit Die
  const hitDieMatch = content.match(/Hit Die[:\s]+d(\d+)/i);
  if (hitDieMatch) {
    features.push({
      name: 'Hit Die',
      value: `d${hitDieMatch[1]}`,
      inline: true
    });
  }

  // Extract Primary Ability
  const abilityMatch = content.match(/Primary Ability[:\s]+(\w+)/i);
  if (abilityMatch) {
    features.push({
      name: 'Primary Ability',
      value: abilityMatch[1],
      inline: true
    });
  }

  return features;
}
```

**Usage:**
```
/class name:wizard
/class name:barbarian
```

## Example 3: `/rule` Command

Look up game rules from any system.

**File**: `src/commands/rule.ts`

```typescript
import { SlashCommandBuilder } from 'discord.js';
import { getCoreClient } from '../lib/core-client.js';
import type { CommandHandler } from './types.js';

export const command = new SlashCommandBuilder()
  .setName('rule')
  .setDescription('Look up a game rule')
  .addStringOption(option =>
    option
      .setName('query')
      .setDescription('What to search for')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('system')
      .setDescription('Game system')
      .addChoices(
        { name: 'D&D 5e', value: 'dnd5e' },
        { name: 'Cypher System', value: 'cypher' },
        { name: 'FoundryVTT', value: 'foundry' },
        { name: 'Any', value: 'all' }
      )
  );

export const handler: CommandHandler = async (interaction) => {
  const query = interaction.options.getString('query', true);
  const system = interaction.options.getString('system') || 'all';

  await interaction.deferReply();

  try {
    const coreClient = getCoreClient();

    // Search KB
    const { articles, total } = await coreClient.kb.list({
      search: query,
      system: system === 'all' ? undefined : system
    });

    if (articles.length === 0) {
      await interaction.editReply(`No rules found for "${query}".`);
      return;
    }

    // Get first result
    const { article } = await coreClient.kb.get(articles[0].slug);

    const embed = {
      title: article.frontmatter.title,
      description: article.content.substring(0, 4000),
      color: 0x3498db,
      fields: [
        {
          name: 'System',
          value: article.frontmatter.system.toUpperCase(),
          inline: true
        },
        {
          name: 'Category',
          value: article.frontmatter.category,
          inline: true
        }
      ],
      footer: {
        text: `${total} results found | Source: ${article.frontmatter.source || 'KB'}`
      }
    };

    // Add "More Results" if applicable
    if (total > 1) {
      const moreResults = articles.slice(1, 4).map(a => a.title).join('\n');
      embed.fields.push({
        name: 'More Results',
        value: moreResults || 'None',
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Rule lookup error:', error);
    await interaction.editReply('Failed to look up rule.');
  }
};
```

**Usage:**
```
/rule query:concentration system:dnd5e
/rule query:effort system:cypher
/rule query:actor system:foundry
```

## Example 4: MCP Integration

The MCP server can now query all 362 articles:

**From Claude Desktop:**

```
Use kb_search tool:
{
  "search": "fireball",
  "system": "dnd5e",
  "category": "spells"
}

Use kb_get_article tool:
{
  "slug": "dnd5e/spells/spell-fireball"
}

Use kb_list_articles tool:
{
  "system": "dnd5e",
  "category": "classes"
}
```

Claude can now assist with:
- Spell descriptions and mechanics
- Class features and progression
- Cypher System rules
- FoundryVTT API documentation

## Example 5: Auto-complete for Spells

Add auto-complete to the `/spell` command:

```typescript
export const autocomplete = async (interaction: AutocompleteInteraction) => {
  const focusedValue = interaction.options.getFocused();

  try {
    const coreClient = getCoreClient();

    // Search spells matching user input
    const { articles } = await coreClient.kb.list({
      system: 'dnd5e',
      category: 'spells',
      search: focusedValue
    });

    // Return up to 25 matches (Discord limit)
    const choices = articles.slice(0, 25).map(article => ({
      name: article.title,
      value: article.slug
    }));

    await interaction.respond(choices);
  } catch (error) {
    await interaction.respond([]);
  }
};
```

## Testing Commands

```bash
# 1. Build FumbleBot
npm run build

# 2. Sync commands to Discord
npm run commands:sync

# 3. Test in Discord
/spell name:fireball
/class name:wizard
/rule query:spellcasting system:dnd5e
```

## Benefits

✅ **362 searchable articles** - Spells, classes, rules, references
✅ **Real-time updates** - Core KB updates instantly available
✅ **Multi-system support** - D&D 5e, Cypher, FoundryVTT, PC games
✅ **Fast search** - Keyword search with filters
✅ **Rich embeds** - Beautiful Discord formatting
✅ **Auto-complete** - Spell names, classes, etc.
✅ **MCP integration** - AI agents can query KB
✅ **Type-safe** - Full TypeScript types from Core SDK

## Next Steps

1. **Implement commands** - Add `/spell`, `/class`, `/rule` commands
2. **Add auto-complete** - Better UX for spell lookups
3. **Rich formatting** - Parse markdown for better embeds
4. **Caching** - Cache frequently accessed articles
5. **Favorites** - Let users save favorite spells/classes
6. **DM tools** - Quick reference for combat, conditions, etc.

---

**Status**: Ready to implement
**KB Articles**: 362 (338 spells, 12 classes, Cypher, Foundry)
**Last Updated**: 2025-12-01
