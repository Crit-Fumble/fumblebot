/**
 * AI API Controller
 *
 * Exposes FumbleBot's AI capabilities as HTTP endpoints.
 * Core and other services call these endpoints to use AI features.
 *
 * Authentication: All endpoints require X-AI-Secret header matching FUMBLEBOT_AI_SECRET
 */

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AIService } from '../services/ai/service.js';
import type {
  AIChatRequest,
  AIChatResponse,
  AICompleteRequest,
  AICompleteResponse,
  AILookupRequest,
  AILookupResponse,
  AIGenerateNPCRequest,
  AIGenerateNPCResponse,
  AIGenerateDungeonRequest,
  AIGenerateDungeonResponse,
  AIGenerateEncounterRequest,
  AIGenerateEncounterResponse,
  AIDMResponseRequest,
  AIDMResponseResponse,
  AICreatureBehaviorRequest,
  AICreatureBehaviorResponse,
  AIGenerateImageRequest,
  AIGenerateImageResponse,
} from '../models/types.js';

// =============================================================================
// Validation Schemas
// =============================================================================

const MessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1).max(100000),
});

const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(100),
  systemPrompt: z.string().max(10000).optional(),
  context: z.object({
    guildId: z.string().max(50).optional(),
    channelId: z.string().max(50).optional(),
    userId: z.string().max(50).optional(),
    gameSystem: z.string().max(100).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
  options: z.object({
    maxTokens: z.number().min(1).max(8192).optional(),
    temperature: z.number().min(0).max(2).optional(),
  }).optional(),
});

const CompleteRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(100),
  systemPrompt: z.string().max(10000).optional(),
  provider: z.enum(['openai', 'anthropic']).optional(),
  model: z.string().max(100).optional(),
  maxTokens: z.number().min(1).max(8192).optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const LookupRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  context: z.string().max(10000).optional(),
  gameSystem: z.string().max(100).optional(),
  maxTokens: z.number().min(1).max(2000).optional(),
});

const GenerateNPCRequestSchema = z.object({
  type: z.string().min(1).max(200),
  setting: z.string().max(100).optional(),
  gameSystem: z.string().max(100).optional(),
  requirements: z.string().max(1000).optional(),
});

const GenerateDungeonRequestSchema = z.object({
  theme: z.string().min(1).max(200),
  size: z.enum(['small', 'medium', 'large']),
  level: z.number().min(1).max(30),
  style: z.string().max(100).optional(),
  gameSystem: z.string().max(100).optional(),
});

const GenerateEncounterRequestSchema = z.object({
  type: z.string().min(1).max(200),
  difficulty: z.enum(['easy', 'medium', 'hard', 'deadly']),
  partyLevel: z.number().min(1).max(30),
  partySize: z.number().min(1).max(20),
  environment: z.string().max(200).optional(),
  gameSystem: z.string().max(100).optional(),
});

const DMResponseRequestSchema = z.object({
  scenario: z.string().min(1).max(5000),
  gameSystem: z.string().max(100).optional(),
  tone: z.enum(['dramatic', 'humorous', 'dark', 'epic', 'casual']).optional(),
});

const CreatureBehaviorRequestSchema = z.object({
  creatureType: z.string().min(1).max(200),
  situation: z.string().min(1).max(2000),
  options: z.array(z.string().max(200)).max(20).optional(),
});

const GenerateImageRequestSchema = z.object({
  prompt: z.string().min(1).max(4000),
  size: z.enum(['1024x1024', '1792x1024', '1024x1792']).optional(),
  style: z.string().max(200).optional(),
});

// =============================================================================
// Authentication Middleware
// =============================================================================

/**
 * Validate AI API secret
 * Requires X-AI-Secret header matching FUMBLEBOT_AI_SECRET
 */
export function validateAISecret(req: Request, res: Response, next: NextFunction): void {
  const aiSecret = req.headers['x-ai-secret'];
  const expectedSecret = process.env.FUMBLEBOT_AI_SECRET;

  if (!expectedSecret) {
    console.error('[AI API] FUMBLEBOT_AI_SECRET not configured');
    res.status(500).json({ error: 'AI API not configured' });
    return;
  }

  if (aiSecret !== expectedSecret) {
    console.warn('[AI API] Invalid AI secret from', req.ip);
    res.status(401).json({ error: 'Invalid AI secret' });
    return;
  }

  next();
}

// =============================================================================
// Helper Functions
// =============================================================================

function getAIService(): AIService {
  return AIService.getInstance();
}

function handleAIError(error: unknown, res: Response, operation: string): void {
  console.error(`[AI API] ${operation} error:`, error);

  if (error instanceof Error) {
    if (error.message.includes('not initialized')) {
      res.status(503).json({
        error: 'AI service unavailable',
        message: error.message,
      });
      return;
    }
  }

  res.status(500).json({
    error: 'AI operation failed',
    message: error instanceof Error ? error.message : 'Unknown error',
  });
}

// =============================================================================
// Handlers
// =============================================================================

/**
 * POST /api/ai/chat
 * General-purpose chat completion using Claude Sonnet
 */
export async function handleAIChat(req: Request, res: Response): Promise<void> {
  const parseResult = ChatRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues,
    });
    return;
  }

  const { messages, systemPrompt, context, options } = parseResult.data as AIChatRequest;

  try {
    const ai = getAIService();

    // TODO: If context.guildId/channelId provided, look up PromptPartials
    // and prepend them to the system prompt

    const result = await ai.chat(
      messages,
      systemPrompt,
      {
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
      }
    );

    const response: AIChatResponse = {
      content: result.content,
      model: result.model,
      usage: result.usage,
    };

    res.json(response);
  } catch (error) {
    handleAIError(error, res, 'chat');
  }
}

/**
 * POST /api/ai/complete
 * Low-level completion with provider choice
 */
export async function handleAIComplete(req: Request, res: Response): Promise<void> {
  const parseResult = CompleteRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues,
    });
    return;
  }

  const { messages, systemPrompt, provider, model, maxTokens, temperature } = parseResult.data as AICompleteRequest;

  try {
    const ai = getAIService();

    const result = await ai.complete({
      messages,
      systemPrompt,
      provider,
      model,
      maxTokens,
      temperature,
    });

    const response: AICompleteResponse = result;

    res.json(response);
  } catch (error) {
    handleAIError(error, res, 'complete');
  }
}

/**
 * POST /api/ai/lookup
 * Fast lookup using Claude Haiku
 */
export async function handleAILookup(req: Request, res: Response): Promise<void> {
  const parseResult = LookupRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues,
    });
    return;
  }

  const { query, context, gameSystem, maxTokens } = parseResult.data as AILookupRequest;

  try {
    const ai = getAIService();

    // Build context with game system if provided
    let lookupContext = context;
    if (gameSystem && !context) {
      lookupContext = `You are a ${gameSystem} rules expert. Provide accurate, concise answers.`;
    }

    const result = await ai.lookup(query, lookupContext, { maxTokens });

    const response: AILookupResponse = {
      content: result.content,
      model: result.model,
      usage: result.usage,
    };

    res.json(response);
  } catch (error) {
    handleAIError(error, res, 'lookup');
  }
}

/**
 * POST /api/ai/generate/npc
 * Generate NPC description
 */
export async function handleAIGenerateNPC(req: Request, res: Response): Promise<void> {
  const parseResult = GenerateNPCRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues,
    });
    return;
  }

  const { type, setting, gameSystem, requirements } = parseResult.data as AIGenerateNPCRequest;

  try {
    const ai = getAIService();

    let prompt = `Generate a ${type} NPC`;
    if (setting) prompt += ` for a ${setting} setting`;
    if (gameSystem) prompt += ` compatible with ${gameSystem}`;
    if (requirements) prompt += `. Requirements: ${requirements}`;

    const content = await ai.generateNPC(type, setting || 'fantasy');

    // Try to parse structured data from the response
    let npc: AIGenerateNPCResponse['npc'];
    try {
      // Look for common patterns in the response
      const nameMatch = content.match(/^#?\s*(?:\*\*)?([^*\n]+?)(?:\*\*)?(?:\n|$)/);
      if (nameMatch) {
        npc = { name: nameMatch[1].trim() };
      }
    } catch {
      // Parsing failed, that's fine
    }

    const response: AIGenerateNPCResponse = {
      content,
      npc,
      model: 'claude-sonnet-4-20250514',
    };

    res.json(response);
  } catch (error) {
    handleAIError(error, res, 'generateNPC');
  }
}

/**
 * POST /api/ai/generate/dungeon
 * Generate dungeon with structured data
 */
export async function handleAIGenerateDungeon(req: Request, res: Response): Promise<void> {
  const parseResult = GenerateDungeonRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues,
    });
    return;
  }

  const { theme, size, level, style } = parseResult.data as AIGenerateDungeonRequest;

  try {
    const ai = getAIService();

    const dungeon = await ai.generateDungeon({ theme, size, level, style });

    const response: AIGenerateDungeonResponse = {
      dungeon,
      model: 'gpt-4o',
    };

    res.json(response);
  } catch (error) {
    handleAIError(error, res, 'generateDungeon');
  }
}

/**
 * POST /api/ai/generate/encounter
 * Generate encounter with structured data
 */
export async function handleAIGenerateEncounter(req: Request, res: Response): Promise<void> {
  const parseResult = GenerateEncounterRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues,
    });
    return;
  }

  const { type, difficulty, partyLevel, partySize, environment } = parseResult.data as AIGenerateEncounterRequest;

  try {
    const ai = getAIService();

    const encounter = await ai.generateEncounter({
      type,
      difficulty,
      partyLevel,
      partySize,
      environment,
    });

    const response: AIGenerateEncounterResponse = {
      encounter,
      model: 'gpt-4o',
    };

    res.json(response);
  } catch (error) {
    handleAIError(error, res, 'generateEncounter');
  }
}

/**
 * POST /api/ai/dm
 * Generate DM response for a scenario
 */
export async function handleAIDMResponse(req: Request, res: Response): Promise<void> {
  const parseResult = DMResponseRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues,
    });
    return;
  }

  const { scenario, gameSystem, tone } = parseResult.data as AIDMResponseRequest;

  try {
    const ai = getAIService();

    const content = await ai.dmResponse(
      scenario,
      gameSystem || 'D&D 5e',
      tone || 'dramatic'
    );

    // Extract suggested rolls from the response
    const rollMatches = content.match(/\b\d*d\d+(?:[+-]\d+)?\b/gi);
    const suggestedRolls = rollMatches ? [...new Set(rollMatches)] : undefined;

    const response: AIDMResponseResponse = {
      content,
      suggestedRolls,
      model: 'claude-sonnet-4-20250514',
    };

    res.json(response);
  } catch (error) {
    handleAIError(error, res, 'dmResponse');
  }
}

/**
 * POST /api/ai/creature-behavior
 * Fast AI decision for creature behavior
 */
export async function handleAICreatureBehavior(req: Request, res: Response): Promise<void> {
  const parseResult = CreatureBehaviorRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues,
    });
    return;
  }

  const { creatureType, situation, options } = parseResult.data as AICreatureBehaviorRequest;

  try {
    const ai = getAIService();

    const result = await ai.creatureBehavior(creatureType, situation, options);

    // Parse action and reasoning from response
    const lines = result.split('\n').filter(l => l.trim());
    const action = lines[0] || result;
    const reasoning = lines.slice(1).join(' ').trim() || 'Instinctive behavior';

    const response: AICreatureBehaviorResponse = {
      action,
      reasoning,
      model: 'claude-3-5-haiku-20241022',
    };

    res.json(response);
  } catch (error) {
    handleAIError(error, res, 'creatureBehavior');
  }
}

/**
 * POST /api/ai/generate/image
 * Generate image using DALL-E
 */
export async function handleAIGenerateImage(req: Request, res: Response): Promise<void> {
  const parseResult = GenerateImageRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues,
    });
    return;
  }

  const { prompt, size, style } = parseResult.data as AIGenerateImageRequest;

  try {
    const ai = getAIService();

    // Enhance prompt with style if provided
    let fullPrompt = prompt;
    if (style) {
      fullPrompt = `${prompt}. Style: ${style}`;
    }

    const url = await ai.generateImage(fullPrompt, size);

    const response: AIGenerateImageResponse = {
      url,
    };

    res.json(response);
  } catch (error) {
    handleAIError(error, res, 'generateImage');
  }
}

/**
 * GET /api/ai/health
 * Check AI service availability
 */
export function handleAIHealth(req: Request, res: Response): void {
  const ai = getAIService();

  res.json({
    status: 'ok',
    providers: {
      anthropic: ai.isProviderAvailable('anthropic'),
      openai: ai.isProviderAvailable('openai'),
    },
    timestamp: new Date().toISOString(),
  });
}
