/**
 * Scripted AI Layer
 * Pre-generated content that can be populated by AI services once,
 * then reused without additional API calls.
 *
 * Use cases:
 * - Creature behavior patterns (pre-generated, then executed without AI)
 * - NPC dialogue trees
 * - Random encounter tables
 * - Cached rule lookups
 * - Pre-built response templates
 */

import { AIService } from './service.js'
import { db } from '../db/index.js'

// ===========================================
// Types
// ===========================================

export interface ScriptedBehavior {
  id: string
  creatureType: string
  conditions: BehaviorCondition[]
  generatedAt: Date
}

export interface BehaviorCondition {
  trigger: string // e.g., "health < 25%", "outnumbered", "target_fleeing"
  action: string // e.g., "flee", "call_for_help", "use_ability:fireball"
  priority: number
  dialogue?: string
}

export interface DialogueNode {
  id: string
  text: string
  speaker: string
  responses?: DialogueResponse[]
  conditions?: string[] // Conditions to show this node
  effects?: string[] // Effects when this node is reached
}

export interface DialogueResponse {
  text: string
  nextNodeId: string | null
  conditions?: string[]
  skillCheck?: { skill: string; dc: number }
}

export interface DialogueTree {
  id: string
  npcName: string
  nodes: Map<string, DialogueNode>
  startNodeId: string
  generatedAt: Date
}

export interface RandomTableEntry {
  weight: number
  result: string
  subTable?: string // Reference to another table for nested rolls
}

export interface RandomTable {
  id: string
  name: string
  entries: RandomTableEntry[]
  generatedAt: Date
}

export interface CachedRule {
  query: string
  system: string
  answer: string
  cachedAt: Date
  expiresAt: Date
}

// ===========================================
// Scripted Content Manager
// ===========================================

export class ScriptedContent {
  private static instance: ScriptedContent | null = null

  // In-memory cache for frequently accessed items (reduces DB queries)
  private behaviorCache: Map<string, ScriptedBehavior> = new Map()
  private dialogueCache: Map<string, DialogueTree> = new Map()
  private tableCache: Map<string, RandomTable> = new Map()

  private constructor() {}

  static getInstance(): ScriptedContent {
    if (!ScriptedContent.instance) {
      ScriptedContent.instance = new ScriptedContent()
    }
    return ScriptedContent.instance
  }

  // ===========================================
  // Creature Behaviors
  // ===========================================

  /**
   * Get or generate behavior script for a creature type
   */
  async getBehavior(creatureType: string, forceRegenerate = false): Promise<ScriptedBehavior> {
    const key = creatureType.toLowerCase()

    // Check in-memory cache first
    if (!forceRegenerate && this.behaviorCache.has(key)) {
      return this.behaviorCache.get(key)!
    }

    // Check database
    if (!forceRegenerate) {
      const dbBehavior = await db.getBehavior(key)
      if (dbBehavior) {
        const behavior: ScriptedBehavior = {
          id: dbBehavior.id,
          creatureType: dbBehavior.creatureType,
          conditions: dbBehavior.conditions as unknown as BehaviorCondition[],
          generatedAt: dbBehavior.generatedAt,
        }
        this.behaviorCache.set(key, behavior)
        return behavior
      }
    }

    // Generate new behavior
    const behavior = await this.generateBehavior(creatureType)

    // Save to database
    await db.saveBehavior(key, behavior.conditions)

    // Cache in memory
    this.behaviorCache.set(key, behavior)
    return behavior
  }

  /**
   * Generate behavior script using AI (one-time cost)
   */
  private async generateBehavior(creatureType: string): Promise<ScriptedBehavior> {
    const ai = AIService.getInstance()

    const prompt = `Generate a behavior script for a ${creatureType} in combat.
Return a JSON array of conditions with triggers, actions, and priorities.
Triggers can be: health_low, health_critical, outnumbered, winning, losing, ally_down, target_fleeing, target_casting
Actions can be: attack, flee, defend, use_ability:[name], call_help, taunt, focus_target, switch_target

Example format:
[
  {"trigger": "health_critical", "action": "flee", "priority": 10, "dialogue": "You'll pay for this!"},
  {"trigger": "outnumbered", "action": "call_help", "priority": 8},
  {"trigger": "default", "action": "attack", "priority": 1}
]`

    const result = await ai.lookup(prompt, 'Return only valid JSON array, no explanation.', { maxTokens: 500 })

    let conditions: BehaviorCondition[]
    try {
      conditions = JSON.parse(result.content)
    } catch {
      // Fallback to basic behavior
      conditions = [
        { trigger: 'health_critical', action: 'flee', priority: 10 },
        { trigger: 'default', action: 'attack', priority: 1 },
      ]
    }

    return {
      id: `behavior_${creatureType.toLowerCase().replace(/\s+/g, '_')}`,
      creatureType,
      conditions,
      generatedAt: new Date(),
    }
  }

  /**
   * Execute behavior script (no AI call needed)
   */
  executeBehavior(behavior: ScriptedBehavior, context: BehaviorContext): BehaviorResult {
    // Sort by priority (higher first)
    const sortedConditions = [...behavior.conditions].sort((a, b) => b.priority - a.priority)

    for (const condition of sortedConditions) {
      if (this.evaluateCondition(condition.trigger, context)) {
        return {
          action: condition.action,
          dialogue: condition.dialogue,
          triggeredBy: condition.trigger,
        }
      }
    }

    // Fallback
    return { action: 'attack', triggeredBy: 'default' }
  }

  private evaluateCondition(trigger: string, context: BehaviorContext): boolean {
    switch (trigger) {
      case 'health_low':
        return context.healthPercent < 50
      case 'health_critical':
        return context.healthPercent < 25
      case 'outnumbered':
        return context.enemyCount > context.allyCount
      case 'winning':
        return context.enemyCount < context.allyCount && context.healthPercent > 50
      case 'losing':
        return context.enemyCount > context.allyCount && context.healthPercent < 50
      case 'ally_down':
        return context.allyDown
      case 'target_fleeing':
        return context.targetFleeing
      case 'target_casting':
        return context.targetCasting
      case 'default':
        return true
      default:
        return false
    }
  }

  // ===========================================
  // Dialogue Trees
  // ===========================================

  /**
   * Get or generate dialogue tree for an NPC
   */
  async getDialogue(npcId: string, npcDescription?: string): Promise<DialogueTree> {
    // Check in-memory cache
    if (this.dialogueCache.has(npcId)) {
      return this.dialogueCache.get(npcId)!
    }

    // Check database
    const dbDialogue = await db.getDialogue(npcId)
    if (dbDialogue) {
      const dialogue: DialogueTree = {
        id: dbDialogue.id,
        npcName: dbDialogue.npcName,
        nodes: new Map(Object.entries(dbDialogue.nodes as any)),
        startNodeId: dbDialogue.startNodeId,
        generatedAt: dbDialogue.generatedAt,
      }
      this.dialogueCache.set(npcId, dialogue)
      return dialogue
    }

    // Generate new dialogue
    if (!npcDescription) {
      throw new Error(`No dialogue tree found for ${npcId} and no description provided to generate one`)
    }

    const dialogue = await this.generateDialogue(npcId, npcDescription)

    // Save to database (convert Map to object)
    const nodesObj = Object.fromEntries(dialogue.nodes.entries())
    await db.saveDialogue(npcId, dialogue.npcName, nodesObj, dialogue.startNodeId)

    // Cache in memory
    this.dialogueCache.set(npcId, dialogue)
    return dialogue
  }

  /**
   * Generate dialogue tree using AI (one-time cost)
   */
  private async generateDialogue(npcId: string, npcDescription: string): Promise<DialogueTree> {
    const ai = AIService.getInstance()

    const prompt = `Create a dialogue tree for this NPC: ${npcDescription}

Return JSON with this structure:
{
  "npcName": "Name",
  "startNodeId": "greeting",
  "nodes": {
    "greeting": {
      "text": "NPC's greeting",
      "responses": [
        {"text": "Player response 1", "nextNodeId": "topic1"},
        {"text": "Player response 2", "nextNodeId": "topic2"},
        {"text": "Goodbye", "nextNodeId": null}
      ]
    },
    "topic1": { ... }
  }
}

Include 3-5 conversation branches with natural dialogue.`

    const result = await ai.chat(
      [{ role: 'user', content: prompt }],
      'You are a dialogue writer for RPGs. Create engaging, character-appropriate dialogue.',
      { maxTokens: 1500 }
    )

    let parsed: any
    try {
      // Extract JSON from response
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch?.[0] || '{}')
    } catch {
      // Fallback to simple dialogue
      parsed = {
        npcName: 'NPC',
        startNodeId: 'greeting',
        nodes: {
          greeting: {
            text: 'Hello, traveler.',
            responses: [{ text: 'Goodbye.', nextNodeId: null }],
          },
        },
      }
    }

    const nodes = new Map<string, DialogueNode>()
    for (const [id, node] of Object.entries(parsed.nodes || {})) {
      nodes.set(id, { id, speaker: parsed.npcName, ...(node as any) })
    }

    return {
      id: npcId,
      npcName: parsed.npcName || 'NPC',
      nodes,
      startNodeId: parsed.startNodeId || 'greeting',
      generatedAt: new Date(),
    }
  }

  /**
   * Get dialogue node (no AI call)
   */
  getDialogueNode(tree: DialogueTree, nodeId: string): DialogueNode | null {
    return tree.nodes.get(nodeId) || null
  }

  /**
   * Store a manually created dialogue tree
   */
  async setDialogue(npcId: string, tree: DialogueTree): Promise<void> {
    // Save to database
    const nodesObj = Object.fromEntries(tree.nodes.entries())
    await db.saveDialogue(npcId, tree.npcName, nodesObj, tree.startNodeId)

    // Cache in memory
    this.dialogueCache.set(npcId, tree)
  }

  // ===========================================
  // Random Tables
  // ===========================================

  /**
   * Get or generate a random table
   */
  async getTable(tableId: string, description?: string): Promise<RandomTable> {
    // Check in-memory cache
    if (this.tableCache.has(tableId)) {
      return this.tableCache.get(tableId)!
    }

    // Check database
    const dbTable = await db.getTable(tableId)
    if (dbTable) {
      const table: RandomTable = {
        id: dbTable.id,
        name: dbTable.name,
        entries: dbTable.entries as unknown as RandomTableEntry[],
        generatedAt: dbTable.generatedAt,
      }
      this.tableCache.set(tableId, table)
      return table
    }

    // Generate new table
    if (!description) {
      throw new Error(`No table found for ${tableId} and no description provided`)
    }

    const table = await this.generateTable(tableId, description)

    // Save to database
    await db.saveTable(tableId, table.name, table.entries)

    // Cache in memory
    this.tableCache.set(tableId, table)
    return table
  }

  /**
   * Generate random table using AI (one-time cost)
   */
  private async generateTable(tableId: string, description: string): Promise<RandomTable> {
    const ai = AIService.getInstance()

    const prompt = `Create a random table for: ${description}

Return JSON array with weighted entries:
[
  {"weight": 10, "result": "Common result"},
  {"weight": 5, "result": "Uncommon result"},
  {"weight": 1, "result": "Rare result"}
]

Include 10-20 entries with varied weights. Higher weight = more common.`

    const result = await ai.generate(
      prompt,
      'You are a TTRPG content creator. Create interesting, varied random tables.',
      { maxTokens: 1000 }
    )

    let entries: RandomTableEntry[]
    try {
      const jsonMatch = result.content.match(/\[[\s\S]*\]/)
      entries = JSON.parse(jsonMatch?.[0] || '[]')
    } catch {
      entries = [{ weight: 1, result: 'Nothing happens' }]
    }

    return {
      id: tableId,
      name: description,
      entries,
      generatedAt: new Date(),
    }
  }

  /**
   * Roll on a table (no AI call)
   */
  rollTable(table: RandomTable): string {
    const totalWeight = table.entries.reduce((sum, e) => sum + e.weight, 0)
    let roll = Math.random() * totalWeight

    for (const entry of table.entries) {
      roll -= entry.weight
      if (roll <= 0) {
        return entry.result
      }
    }

    return table.entries[table.entries.length - 1]?.result || 'Nothing'
  }

  /**
   * Store a manually created table
   */
  async setTable(tableId: string, table: RandomTable): Promise<void> {
    // Save to database
    await db.saveTable(tableId, table.name, table.entries)

    // Cache in memory
    this.tableCache.set(tableId, table)
  }

  // ===========================================
  // Rule Cache
  // ===========================================

  /**
   * Get cached rule or look it up
   */
  async getRule(query: string, system = 'D&D 5e', ttlHours = 24): Promise<string> {
    // Check database for cached rule
    const cached = await db.getCachedRule(system, query)
    if (cached) {
      return cached.answer
    }

    // Look up with AI
    const ai = AIService.getInstance()
    const answer = await ai.lookupRule(query, system)

    // Save to database
    await db.saveRule(system, query, answer, ttlHours)

    return answer
  }

  /**
   * Pre-cache common rules
   */
  async precacheRules(queries: string[], system = 'D&D 5e'): Promise<void> {
    for (const query of queries) {
      await this.getRule(query, system)
    }
  }

  /**
   * Clear expired cache entries from database
   */
  async clearExpiredCache(): Promise<number> {
    return db.clearExpiredRules()
  }

  /**
   * Clear in-memory caches (useful for freeing memory)
   */
  clearMemoryCache(): void {
    this.behaviorCache.clear()
    this.dialogueCache.clear()
    this.tableCache.clear()
  }
}

// ===========================================
// Context Types for Behavior Execution
// ===========================================

export interface BehaviorContext {
  healthPercent: number
  enemyCount: number
  allyCount: number
  allyDown: boolean
  targetFleeing: boolean
  targetCasting: boolean
  [key: string]: any // Allow custom context
}

export interface BehaviorResult {
  action: string
  dialogue?: string
  triggeredBy: string
}
