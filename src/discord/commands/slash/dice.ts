/**
 * Dice Commands
 * TTRPG dice rolling functionality
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js'
import type { FumbleBotClient } from '../../client.js'

// Dice roll result
interface DiceRoll {
  dice: string
  rolls: number[]
  modifier: number
  total: number
  isCrit: boolean
  isFumble: boolean
}

/**
 * Parse and roll dice notation (e.g., "2d6+3", "1d20", "4d6kh3")
 */
function rollDice(notation: string): DiceRoll {
  // Parse notation: NdS+M or NdS-M
  const match = notation.toLowerCase().match(/^(\d+)?d(\d+)([+-]\d+)?$/i)

  if (!match) {
    throw new Error(`Invalid dice notation: ${notation}`)
  }

  const count = parseInt(match[1] || '1', 10)
  const sides = parseInt(match[2], 10)
  const modifier = parseInt(match[3] || '0', 10)

  if (count < 1 || count > 100) {
    throw new Error('Dice count must be between 1 and 100')
  }

  if (sides < 2 || sides > 1000) {
    throw new Error('Dice sides must be between 2 and 1000')
  }

  // Roll the dice
  const rolls: number[] = []
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1)
  }

  const total = rolls.reduce((sum, roll) => sum + roll, 0) + modifier

  // Check for crit/fumble on d20
  const isCrit = sides === 20 && count === 1 && rolls[0] === 20
  const isFumble = sides === 20 && count === 1 && rolls[0] === 1

  return {
    dice: notation,
    rolls,
    modifier,
    total,
    isCrit,
    isFumble,
  }
}

/**
 * Create dice roll embed
 */
function createDiceEmbed(roll: DiceRoll, username: string): EmbedBuilder {
  let color = 0x7c3aed // Purple default

  if (roll.isCrit) {
    color = 0x22c55e // Green for crit
  } else if (roll.isFumble) {
    color = 0xef4444 // Red for fumble
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(
      roll.isCrit ? '🎉 CRITICAL HIT!' : roll.isFumble ? '💀 FUMBLE!' : '🎲 Dice Roll'
    )
    .setDescription(`**${username}** rolled **${roll.dice}**`)
    .addFields(
      {
        name: 'Rolls',
        value: `[${roll.rolls.join(', ')}]`,
        inline: true,
      },
      {
        name: 'Modifier',
        value: roll.modifier >= 0 ? `+${roll.modifier}` : `${roll.modifier}`,
        inline: true,
      },
      {
        name: 'Total',
        value: `**${roll.total}**`,
        inline: true,
      }
    )
    .setFooter({ text: 'Powered by FumbleBot' })
    .setTimestamp()

  return embed
}

// Define slash commands
export const diceCommands = [
  new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll dice using standard notation')
    .addStringOption((option) =>
      option
        .setName('dice')
        .setDescription('Dice notation (e.g., 2d6+3, 1d20, 4d6)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('label')
        .setDescription('Optional label for the roll')
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName('private')
        .setDescription('Only show the result to you')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('d20')
    .setDescription('Quick roll a d20')
    .addIntegerOption((option) =>
      option
        .setName('modifier')
        .setDescription('Modifier to add to the roll')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('advantage')
    .setDescription('Roll 2d20 and take the higher (advantage)')
    .addIntegerOption((option) =>
      option
        .setName('modifier')
        .setDescription('Modifier to add to the roll')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('disadvantage')
    .setDescription('Roll 2d20 and take the lower (disadvantage)')
    .addIntegerOption((option) =>
      option
        .setName('modifier')
        .setDescription('Modifier to add to the roll')
        .setRequired(false)
    ),
]

// Command handler
export async function diceHandler(
  interaction: ChatInputCommandInteraction,
  _bot: FumbleBotClient
): Promise<void> {
  const commandName = interaction.commandName
  const username = interaction.user.displayName || interaction.user.username

  try {
    if (commandName === 'roll') {
      const diceNotation = interaction.options.getString('dice', true)
      const label = interaction.options.getString('label')
      const isPrivate = interaction.options.getBoolean('private') ?? false

      const roll = rollDice(diceNotation)
      const embed = createDiceEmbed(roll, username)

      if (label) {
        embed.setDescription(`**${username}** rolled **${roll.dice}** for *${label}*`)
      }

      await interaction.reply({ embeds: [embed], ephemeral: isPrivate })
    } else if (commandName === 'd20') {
      const modifier = interaction.options.getInteger('modifier') ?? 0
      const notation = modifier === 0 ? '1d20' : `1d20${modifier >= 0 ? '+' : ''}${modifier}`
      const roll = rollDice(notation)
      const embed = createDiceEmbed(roll, username)

      await interaction.reply({ embeds: [embed] })
    } else if (commandName === 'advantage') {
      const modifier = interaction.options.getInteger('modifier') ?? 0

      // Roll two d20s
      const roll1 = Math.floor(Math.random() * 20) + 1
      const roll2 = Math.floor(Math.random() * 20) + 1
      const higher = Math.max(roll1, roll2)
      const total = higher + modifier

      const isCrit = higher === 20
      const isFumble = higher === 1

      let color = 0x7c3aed
      if (isCrit) color = 0x22c55e
      if (isFumble) color = 0xef4444

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(
          isCrit ? '🎉 CRITICAL HIT!' : isFumble ? '💀 FUMBLE!' : '🎲 Advantage Roll'
        )
        .setDescription(`**${username}** rolled with **advantage**`)
        .addFields(
          {
            name: 'Rolls',
            value: `[${roll1}, ${roll2}] → **${higher}**`,
            inline: true,
          },
          {
            name: 'Modifier',
            value: modifier >= 0 ? `+${modifier}` : `${modifier}`,
            inline: true,
          },
          {
            name: 'Total',
            value: `**${total}**`,
            inline: true,
          }
        )
        .setFooter({ text: 'Taking the higher roll' })
        .setTimestamp()

      await interaction.reply({ embeds: [embed] })
    } else if (commandName === 'disadvantage') {
      const modifier = interaction.options.getInteger('modifier') ?? 0

      // Roll two d20s
      const roll1 = Math.floor(Math.random() * 20) + 1
      const roll2 = Math.floor(Math.random() * 20) + 1
      const lower = Math.min(roll1, roll2)
      const total = lower + modifier

      const isCrit = lower === 20
      const isFumble = lower === 1

      let color = 0x7c3aed
      if (isCrit) color = 0x22c55e
      if (isFumble) color = 0xef4444

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(
          isCrit ? '🎉 CRITICAL HIT!' : isFumble ? '💀 FUMBLE!' : '🎲 Disadvantage Roll'
        )
        .setDescription(`**${username}** rolled with **disadvantage**`)
        .addFields(
          {
            name: 'Rolls',
            value: `[${roll1}, ${roll2}] → **${lower}**`,
            inline: true,
          },
          {
            name: 'Modifier',
            value: modifier >= 0 ? `+${modifier}` : `${modifier}`,
            inline: true,
          },
          {
            name: 'Total',
            value: `**${total}**`,
            inline: true,
          }
        )
        .setFooter({ text: 'Taking the lower roll' })
        .setTimestamp()

      await interaction.reply({ embeds: [embed] })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to roll dice'
    await interaction.reply({ content: `❌ ${errorMessage}`, ephemeral: true })
  }
}
