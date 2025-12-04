/**
 * Persona & Memory MCP Handlers
 * Allows FumbleBot to learn, remember, and manage its personas
 */

import type { MCPToolResult } from './types.js';
import {
  remember,
  recall,
  forget,
  learnSkill,
  getPersona,
  listPersonas,
  recordSkillUsage,
  getPersonaContext,
} from '../../services/persona/index.js';

export class PersonaHandler {
  async handle(name: string, args: any): Promise<MCPToolResult> {
    switch (name) {
      case 'memory_remember':
        return await this.remember(args);

      case 'memory_recall':
        return await this.recall(args);

      case 'memory_forget':
        return await this.forget(args);

      case 'skill_learn':
        return await this.learnSkill(args);

      case 'skill_used':
        return await this.skillUsed(args);

      case 'persona_list':
        return await this.listPersonas(args);

      case 'persona_get':
        return await this.getPersona(args);

      case 'persona_context':
        return await this.getContext(args);

      default:
        throw new Error(`Unknown persona tool: ${name}`);
    }
  }

  private async remember(args: any): Promise<MCPToolResult> {
    const { guildId, type, key, content, category, confidence } = args;

    try {
      const memory = await remember({
        guildId,
        type: type || 'fact',
        category: category || 'general',
        key,
        content,
        confidence: confidence || 1.0,
      });

      return {
        content: [{
          type: 'text',
          text: `Remembered: [${memory.type}] ${memory.key}`,
        }],
        _meta: { memoryId: memory.id },
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to remember: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }

  private async recall(args: any): Promise<MCPToolResult> {
    const { guildId, type, category, key, limit } = args;

    try {
      const memories = await recall({
        guildId,
        type,
        category,
        key,
        limit: limit || 10,
      });

      if (memories.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No relevant memories found.',
          }],
        };
      }

      const formatted = memories.map(m =>
        `- [${m.type}/${m.category}] ${m.key}: ${m.content} (confidence: ${m.confidence.toFixed(2)})`
      ).join('\n');

      return {
        content: [{
          type: 'text',
          text: `Recalled ${memories.length} memories:\n${formatted}`,
        }],
        _meta: { count: memories.length },
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to recall: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }

  private async forget(args: any): Promise<MCPToolResult> {
    const { guildId, type, key } = args;

    try {
      await forget(guildId, type, key);

      return {
        content: [{
          type: 'text',
          text: `Forgot: [${type}] ${key}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to forget: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }

  private async learnSkill(args: any): Promise<MCPToolResult> {
    const { slug, name, description, category, toolName, personaSlug } = args;

    try {
      const skill = await learnSkill({
        slug,
        name,
        description,
        category,
        toolName,
        personaSlug,
      });

      return {
        content: [{
          type: 'text',
          text: `Learned skill: ${skill.name} (${skill.category})`,
        }],
        _meta: { skillId: skill.id },
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to learn skill: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }

  private async skillUsed(args: any): Promise<MCPToolResult> {
    const { skillSlug } = args;

    try {
      await recordSkillUsage(skillSlug);

      return {
        content: [{
          type: 'text',
          text: `Recorded usage of: ${skillSlug}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to record skill usage: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }

  private async listPersonas(args: any): Promise<MCPToolResult> {
    const { guildId } = args;

    try {
      const personas = await listPersonas(guildId);

      const formatted = personas.map(p =>
        `- **${p.name}** (\`${p.slug}\`): ${p.description || 'No description'} [voice: ${p.voice}]`
      ).join('\n');

      return {
        content: [{
          type: 'text',
          text: `Available personas:\n${formatted}`,
        }],
        _meta: { count: personas.length },
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to list personas: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }

  private async getPersona(args: any): Promise<MCPToolResult> {
    const { slug } = args;

    try {
      const persona = await getPersona(slug);

      if (!persona) {
        return {
          content: [{
            type: 'text',
            text: `Persona not found: ${slug}`,
          }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            name: persona.name,
            slug: persona.slug,
            description: persona.description,
            voice: persona.voice,
            personality: persona.personality?.slice(0, 200) + '...',
            skills: persona.skills.map(s => s.name),
            model: persona.primaryModel,
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to get persona: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }

  private async getContext(args: any): Promise<MCPToolResult> {
    const { personaSlug, guildId } = args;

    try {
      const context = await getPersonaContext(personaSlug || 'fumblebot', guildId);

      return {
        content: [{
          type: 'text',
          text: context,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to get context: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }
}
