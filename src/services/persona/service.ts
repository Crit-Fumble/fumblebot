/**
 * Persona Service
 * Manages FumbleBot's personas, skills, memories, and character webhooks
 */

import { prisma } from '../db/index.js';
import type { BotPersona, BotSkill, BotMemory, PersonaWebhook } from '../db/index.js';

// Built-in skills that map to MCP tools
export const BUILT_IN_SKILLS = [
  { slug: 'dice-rolling', name: 'Dice Rolling', category: 'tools', toolName: 'roll_dice' },
  { slug: 'kb-search', name: 'Knowledge Base Search', category: 'knowledge', toolName: 'kb_search' },
  { slug: '5e-tools-search', name: '5e.tools Search', category: 'knowledge', toolName: 'web_search_5etools' },
  { slug: 'fandom-wiki', name: 'Fandom Wiki Search', category: 'knowledge', toolName: 'web_search_fandom_wiki' },
  { slug: 'forgotten-realms', name: 'Forgotten Realms Lore', category: 'knowledge', toolName: 'web_search_forgotten_realms' },
  { slug: 'cypher-srd', name: 'Cypher System SRD', category: 'knowledge', toolName: 'web_search_cypher_srd' },
  { slug: 'world-anvil', name: 'World Anvil Integration', category: 'knowledge', toolName: 'worldanvil_search_articles' },
  { slug: 'npc-generation', name: 'NPC Generation', category: 'roleplay', toolName: 'generate_npc' },
  { slug: 'lore-generation', name: 'Lore Generation', category: 'roleplay', toolName: 'generate_lore' },
  { slug: 'voice-control', name: 'Voice Channel Control', category: 'tools', toolName: 'voice_join' },
  { slug: 'foundry-tools', name: 'Foundry VTT Tools', category: 'tools', toolName: 'foundry_screenshot' },
  { slug: 'web-search', name: 'Web Search', category: 'knowledge', toolName: 'web_search' },
];

/**
 * Initialize built-in skills and default persona
 */
export async function initializePersonaSystem(): Promise<void> {
  console.log('[Persona] Initializing persona system...');

  // Create built-in skills
  for (const skill of BUILT_IN_SKILLS) {
    await prisma.botSkill.upsert({
      where: { slug: skill.slug },
      update: { name: skill.name, category: skill.category, toolName: skill.toolName },
      create: {
        slug: skill.slug,
        name: skill.name,
        category: skill.category,
        toolName: skill.toolName,
        isBuiltIn: true,
      },
    });
  }

  // Create default FumbleBot persona if it doesn't exist
  const defaultPersona = await prisma.botPersona.upsert({
    where: { slug: 'fumblebot' },
    update: {},
    create: {
      slug: 'fumblebot',
      name: 'FumbleBot',
      description: 'The default TTRPG assistant persona',
      voice: 'orion',
      personality: `You are FumbleBot, a helpful TTRPG assistant. You help with rules lookups, dice rolling, lore questions, and game management. You're knowledgeable but concise. You don't add unnecessary flair - just useful info.`,
      primaryModel: 'claude-sonnet',
      lookupModel: 'claude-haiku',
      maxTokens: 2000,
      temperature: 0.7,
      isGlobal: true,
    },
  });

  // Attach all built-in skills to default persona
  const allSkills = await prisma.botSkill.findMany({ where: { isBuiltIn: true } });
  await prisma.botPersona.update({
    where: { id: defaultPersona.id },
    data: {
      skills: {
        connect: allSkills.map(s => ({ id: s.id })),
      },
    },
  });

  console.log(`[Persona] Initialized with ${allSkills.length} built-in skills`);
}

/**
 * Get or create the default persona
 */
export async function getDefaultPersona(): Promise<BotPersona & { skills: BotSkill[] }> {
  let persona = await prisma.botPersona.findUnique({
    where: { slug: 'fumblebot' },
    include: { skills: true },
  });

  if (!persona) {
    await initializePersonaSystem();
    persona = await prisma.botPersona.findUnique({
      where: { slug: 'fumblebot' },
      include: { skills: true },
    });
  }

  return persona!;
}

/**
 * Get a persona by slug
 */
export async function getPersona(slug: string): Promise<(BotPersona & { skills: BotSkill[] }) | null> {
  return prisma.botPersona.findUnique({
    where: { slug },
    include: { skills: true, webhooks: true },
  });
}

/**
 * List personas available to a guild
 */
export async function listPersonas(guildId?: string): Promise<BotPersona[]> {
  return prisma.botPersona.findMany({
    where: {
      OR: [
        { isGlobal: true },
        { guildId },
      ],
    },
    include: { skills: true },
    orderBy: { name: 'asc' },
  });
}

/**
 * Create a new persona
 */
export async function createPersona(data: {
  name: string;
  slug: string;
  description?: string;
  voice?: string;
  avatarUrl?: string;
  personality?: string;
  primaryModel?: string;
  lookupModel?: string;
  maxTokens?: number;
  temperature?: number;
  guildId?: string;
  createdBy?: string;
  isGlobal?: boolean;
}): Promise<BotPersona> {
  return prisma.botPersona.create({
    data: {
      name: data.name,
      slug: data.slug.toLowerCase().replace(/\s+/g, '-'),
      description: data.description,
      voice: data.voice || 'orion',
      avatarUrl: data.avatarUrl,
      personality: data.personality,
      primaryModel: data.primaryModel || 'claude-sonnet',
      lookupModel: data.lookupModel || 'claude-haiku',
      maxTokens: data.maxTokens || 2000,
      temperature: data.temperature || 0.7,
      guildId: data.guildId,
      createdBy: data.createdBy,
      isGlobal: data.isGlobal || false,
    },
  });
}

/**
 * Create or get a webhook for a persona in a channel
 */
export async function getOrCreatePersonaWebhook(
  personaId: string,
  guildId: string,
  channelId: string,
  createWebhook: () => Promise<{ id: string; token: string; name?: string }>
): Promise<PersonaWebhook> {
  // Check if webhook exists
  let webhook = await prisma.personaWebhook.findUnique({
    where: { personaId_channelId: { personaId, channelId } },
  });

  if (!webhook) {
    // Create Discord webhook
    const discordWebhook = await createWebhook();

    webhook = await prisma.personaWebhook.create({
      data: {
        personaId,
        guildId,
        channelId,
        webhookId: discordWebhook.id,
        webhookToken: discordWebhook.token,
        channelName: discordWebhook.name,
      },
    });
  }

  return webhook;
}

/**
 * Record skill usage
 */
export async function recordSkillUsage(skillSlug: string): Promise<void> {
  await prisma.botSkill.update({
    where: { slug: skillSlug },
    data: {
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  }).catch(() => {
    // Skill might not exist yet
  });
}

/**
 * Learn a new skill (create if doesn't exist)
 */
export async function learnSkill(data: {
  slug: string;
  name: string;
  description?: string;
  category?: string;
  toolName?: string;
  personaSlug?: string;
}): Promise<BotSkill> {
  const skill = await prisma.botSkill.upsert({
    where: { slug: data.slug },
    update: { name: data.name, description: data.description },
    create: {
      slug: data.slug,
      name: data.name,
      description: data.description,
      category: data.category || 'general',
      toolName: data.toolName,
      isBuiltIn: false,
    },
  });

  // Attach to persona if specified
  if (data.personaSlug) {
    await prisma.botPersona.update({
      where: { slug: data.personaSlug },
      data: {
        skills: { connect: { id: skill.id } },
      },
    }).catch(() => {});
  }

  return skill;
}

// ============================================
// Memory System
// ============================================

/**
 * Remember something
 */
export async function remember(data: {
  guildId?: string;
  channelId?: string;
  userId?: string;
  type: 'skill' | 'fact' | 'preference' | 'correction';
  category?: string;
  key: string;
  content: string;
  confidence?: number;
  expiresAt?: Date;
}): Promise<BotMemory> {
  return prisma.botMemory.upsert({
    where: {
      guildId_type_key: {
        guildId: data.guildId || '',
        type: data.type,
        key: data.key,
      },
    },
    update: {
      content: data.content,
      confidence: data.confidence || 1.0,
      channelId: data.channelId,
      userId: data.userId,
      expiresAt: data.expiresAt,
    },
    create: {
      guildId: data.guildId,
      channelId: data.channelId,
      userId: data.userId,
      type: data.type,
      category: data.category || 'general',
      key: data.key,
      content: data.content,
      confidence: data.confidence || 1.0,
      expiresAt: data.expiresAt,
    },
  });
}

/**
 * Recall memories by type/category
 */
export async function recall(options: {
  guildId?: string;
  type?: string;
  category?: string;
  key?: string;
  limit?: number;
}): Promise<BotMemory[]> {
  const where: any = {};

  if (options.guildId) {
    where.OR = [
      { guildId: options.guildId },
      { guildId: null }, // Global memories
    ];
  }
  if (options.type) where.type = options.type;
  if (options.category) where.category = options.category;
  if (options.key) where.key = { contains: options.key };

  // Exclude expired memories
  where.OR = [
    ...(where.OR || []),
    { expiresAt: null },
    { expiresAt: { gt: new Date() } },
  ];

  const memories = await prisma.botMemory.findMany({
    where,
    orderBy: [
      { confidence: 'desc' },
      { usageCount: 'desc' },
    ],
    take: options.limit || 10,
  });

  // Update usage tracking
  if (memories.length > 0) {
    await prisma.botMemory.updateMany({
      where: { id: { in: memories.map(m => m.id) } },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  return memories;
}

/**
 * Forget a memory
 */
export async function forget(guildId: string, type: string, key: string): Promise<void> {
  await prisma.botMemory.delete({
    where: {
      guildId_type_key: { guildId, type, key },
    },
  }).catch(() => {});
}

/**
 * Decay old memories (reduce confidence over time)
 */
export async function decayMemories(daysOld: number = 30, decayAmount: number = 0.1): Promise<number> {
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

  const result = await prisma.botMemory.updateMany({
    where: {
      updatedAt: { lt: cutoff },
      confidence: { gt: decayAmount },
    },
    data: {
      confidence: { decrement: decayAmount },
    },
  });

  // Delete memories with very low confidence
  await prisma.botMemory.deleteMany({
    where: { confidence: { lt: 0.1 } },
  });

  return result.count;
}

/**
 * Get persona context for AI prompts
 */
export async function getPersonaContext(personaSlug: string, guildId?: string): Promise<string> {
  const persona = await getPersona(personaSlug) || await getDefaultPersona();
  const memories = guildId ? await recall({ guildId, limit: 20 }) : [];

  let context = '';

  // Persona identity
  if (persona.personality) {
    context += `${persona.personality}\n\n`;
  }

  // Skills awareness
  if (persona.skills.length > 0) {
    context += `You have these capabilities: ${persona.skills.map(s => s.name).join(', ')}.\n\n`;
  }

  // Relevant memories
  if (memories.length > 0) {
    context += 'Things you remember:\n';
    for (const mem of memories) {
      context += `- [${mem.type}] ${mem.key}: ${mem.content}\n`;
    }
    context += '\n';
  }

  return context;
}
