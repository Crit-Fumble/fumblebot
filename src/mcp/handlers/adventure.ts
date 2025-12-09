/**
 * Adventure Tool Handlers
 * Handles MUD-style text adventure operations via Core Adventure API
 */

import adventureService from '../../services/terminal/adventure-service.js';
import { formatAdventureMessage } from '../../services/terminal/output-formatter.js';
import type { MCPToolResult } from './types.js';

export class AdventureHandler {
  async handle(name: string, args: any): Promise<MCPToolResult> {
    switch (name) {
      case 'adventure_create': {
        const session = await adventureService.create(
          args.guildId,
          args.channelId,
          args.name,
          args.description
        );
        return {
          content: [
            {
              type: 'text',
              text: `Adventure created: "${session.name}" (ID: ${session.id})\nStatus: ${session.status}\nPlayers can join with /adventure join`,
            },
          ],
        };
      }

      case 'adventure_join': {
        const result = await adventureService.join(
          args.adventureId,
          args.playerId,
          args.playerName,
          args.role || 'player'
        );
        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? `${args.playerName} joined the adventure as ${args.role || 'player'}. Players: ${result.playerCount}`
                : 'Failed to join adventure',
            },
          ],
        };
      }

      case 'adventure_action': {
        const result = await adventureService.sendAction(
          args.adventureId,
          args.playerId,
          args.content
        );
        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? formatAdventureMessage(result.message)
                : 'Failed to send action',
            },
          ],
        };
      }

      case 'adventure_say': {
        const result = await adventureService.say(
          args.adventureId,
          args.playerId,
          args.content
        );
        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? formatAdventureMessage(result.message)
                : 'Failed to send dialogue',
            },
          ],
        };
      }

      case 'adventure_emote': {
        const result = await adventureService.emote(
          args.adventureId,
          args.playerId,
          args.content
        );
        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? formatAdventureMessage(result.message)
                : 'Failed to send emote',
            },
          ],
        };
      }

      case 'adventure_narrative': {
        const result = await adventureService.sendNarrative(
          args.adventureId,
          args.playerId,
          args.content
        );
        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? formatAdventureMessage(result.message)
                : 'Failed to send narrative',
            },
          ],
        };
      }

      case 'adventure_status': {
        let adventure;
        if (args.adventureId) {
          adventure = await adventureService.get(args.adventureId);
        } else if (args.guildId && args.channelId) {
          adventure = await adventureService.getByChannel(args.guildId, args.channelId);
        } else {
          return {
            content: [
              {
                type: 'text',
                text: 'Must provide either adventureId or both guildId and channelId',
              },
            ],
            isError: true,
          };
        }

        if (!adventure) {
          return {
            content: [
              {
                type: 'text',
                text: 'No adventure found',
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  id: adventure.id,
                  name: adventure.name,
                  description: adventure.description,
                  status: adventure.status,
                  playerCount: adventure.playerCount,
                  players: adventure.players?.map((p) => ({
                    name: p.playerName,
                    role: p.role,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'adventure_history': {
        const messages = await adventureService.getHistory(
          args.adventureId,
          args.limit || 20
        );
        const formatted = messages.map((m) => formatAdventureMessage(m)).join('\n');
        return {
          content: [
            {
              type: 'text',
              text: formatted || '(No messages yet)',
            },
          ],
        };
      }

      case 'adventure_end': {
        const success = await adventureService.end(args.adventureId);
        return {
          content: [
            {
              type: 'text',
              text: success
                ? 'Adventure ended successfully'
                : 'Failed to end adventure',
            },
          ],
        };
      }

      case 'adventure_list': {
        const adventures = await adventureService.list();
        if (adventures.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No active adventures',
              },
            ],
          };
        }
        const list = adventures
          .map((a) => `• ${a.name} (${a.status}) - ${a.playerCount} players`)
          .join('\n');
        return {
          content: [
            {
              type: 'text',
              text: `Active Adventures:\n${list}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown Adventure tool: ${name}`);
    }
  }
}
