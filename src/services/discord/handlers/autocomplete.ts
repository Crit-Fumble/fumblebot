/**
 * Autocomplete Handler
 * Handles autocomplete interactions for slash commands
 */

import type { AutocompleteInteraction } from 'discord.js'
import type { FumbleBotClient } from '../client.js'
import { eventAutocomplete } from '../commands/slash/event.js'

/**
 * Handle autocomplete interactions
 */
export async function handleAutocomplete(
  interaction: AutocompleteInteraction,
  _bot: FumbleBotClient
): Promise<void> {
  const commandName = interaction.commandName
  const focusedOption = interaction.options.getFocused(true)

  try {
    let choices: { name: string; value: string }[] = []

    // Route to appropriate autocomplete handler
    switch (commandName) {
      case 'roll':
        choices = getRollAutocomplete(focusedOption.value)
        break

      case 'session':
        choices = await getSessionAutocomplete(focusedOption.name, focusedOption.value)
        break

      case 'npc':
      case 'lore':
        choices = getContentAutocomplete(focusedOption.name, focusedOption.value)
        break

      case 'event':
        choices = await eventAutocomplete(interaction)
        break

      default:
        choices = []
    }

    // Respond with choices (max 25)
    await interaction.respond(choices.slice(0, 25))
  } catch (error) {
    console.error('[FumbleBot] Autocomplete error:', error)
    await interaction.respond([])
  }
}

/**
 * Autocomplete for dice roll command
 */
function getRollAutocomplete(query: string): { name: string; value: string }[] {
  const commonDice = [
    { name: '1d20 - Standard d20', value: '1d20' },
    { name: '2d6 - Two six-sided dice', value: '2d6' },
    { name: '1d20+5 - d20 with +5 modifier', value: '1d20+5' },
    { name: '4d6kh3 - Roll 4d6, keep highest 3 (stats)', value: '4d6' },
    { name: '1d100 - Percentile', value: '1d100' },
    { name: '1d12 - Greataxe/Greatword damage', value: '1d12' },
    { name: '2d6+3 - Greatsword with modifier', value: '2d6+3' },
    { name: '1d8 - Longsword/Rapier damage', value: '1d8' },
    { name: '1d10 - Heavy crossbow', value: '1d10' },
    { name: '1d4 - Dagger damage', value: '1d4' },
    { name: '8d6 - Fireball damage', value: '8d6' },
    { name: '10d6 - Lightning Bolt', value: '10d6' },
    { name: '2d10 - Eldritch Blast (2 beams)', value: '2d10' },
  ]

  if (!query) {
    return commonDice.slice(0, 10)
  }

  const lowerQuery = query.toLowerCase()
  return commonDice.filter(
    (dice) =>
      dice.value.toLowerCase().includes(lowerQuery) ||
      dice.name.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Autocomplete for session commands
 */
async function getSessionAutocomplete(
  optionName: string,
  query: string
): Promise<{ name: string; value: string }[]> {
  if (optionName === 'code') {
    // TODO: Fetch recent sessions from API
    return [
      { name: 'ABC123 - Dragon Heist', value: 'ABC123' },
      { name: 'XYZ789 - Curse of Strahd', value: 'XYZ789' },
    ]
  }

  if (optionName === 'name') {
    // Suggest common session names
    const suggestions = [
      'Session 1 - The Beginning',
      'Session 2 - Into the Dungeon',
      'One-Shot: Goblin Caves',
      'Campaign Start',
      'Character Creation',
    ]

    if (!query) {
      return suggestions.map((s) => ({ name: s, value: s }))
    }

    return suggestions
      .filter((s) => s.toLowerCase().includes(query.toLowerCase()))
      .map((s) => ({ name: s, value: s }))
  }

  return []
}

/**
 * Autocomplete for content generation commands
 */
function getContentAutocomplete(
  optionName: string,
  query: string
): { name: string; value: string }[] {
  if (optionName === 'type') {
    const npcTypes = [
      'Merchant',
      'Guard',
      'Innkeeper',
      'Blacksmith',
      'Noble',
      'Peasant',
      'Mysterious Stranger',
      'Traveling Bard',
      'Suspicious Hooded Figure',
      'Grizzled Veteran',
      'Young Apprentice',
      'Elderly Sage',
      'Cheerful Bartender',
      'Corrupt Official',
      'Helpful Farmer',
    ]

    if (!query) {
      return npcTypes.slice(0, 10).map((t) => ({ name: t, value: t.toLowerCase() }))
    }

    return npcTypes
      .filter((t) => t.toLowerCase().includes(query.toLowerCase()))
      .map((t) => ({ name: t, value: t.toLowerCase() }))
  }

  if (optionName === 'topic') {
    const topics = [
      'The Great War',
      'The Founding of the Kingdom',
      'The Dragon Apocalypse',
      'The Lost Artifact',
      'The Forbidden Magic',
      'The Ancient Prophecy',
      'The Hidden Temple',
      'The Cursed Bloodline',
      'The Planar Convergence',
      'The Rise of the Lich King',
    ]

    if (!query) {
      return topics.slice(0, 10).map((t) => ({ name: t, value: t }))
    }

    return topics
      .filter((t) => t.toLowerCase().includes(query.toLowerCase()))
      .map((t) => ({ name: t, value: t }))
  }

  if (optionName === 'setting') {
    const settings = [
      'High Fantasy',
      'Dark Fantasy',
      'Medieval Europe',
      'Steampunk',
      'Post-Apocalyptic',
      'Science Fantasy',
      'Urban Fantasy',
      'Lovecraftian Horror',
      'Sword & Sorcery',
      'Mythological Greece',
    ]

    if (!query) {
      return settings.slice(0, 10).map((s) => ({ name: s, value: s.toLowerCase() }))
    }

    return settings
      .filter((s) => s.toLowerCase().includes(query.toLowerCase()))
      .map((s) => ({ name: s, value: s.toLowerCase() }))
  }

  return []
}
