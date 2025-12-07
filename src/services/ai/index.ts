/**
 * AI Module
 * Exports AI-related functionality
 *
 * Layers:
 * 1. AIService - Direct API calls to OpenAI/Anthropic
 * 2. GradientService - DigitalOcean Gradient AI (Llama, Claude via DO)
 * 3. ScriptedContent - Pre-generated content cached for reuse
 * 4. ThinkingService - Internal reasoning/thought logging
 * 5. LookupAgent - Context-aware information retrieval
 */

export { AIService } from './service.js'
export {
  GradientService,
  gradient,
  type GradientCompletionOptions,
  type GradientCompletionResult,
  type GradientModel,
} from './gradient.js'
export {
  ScriptedContent,
  type ScriptedBehavior,
  type BehaviorCondition,
  type BehaviorContext,
  type BehaviorResult,
  type DialogueTree,
  type DialogueNode,
  type DialogueResponse,
  type RandomTable,
  type RandomTableEntry,
  type CachedRule,
} from './scripted.js'

// Thinking/Reasoning System
export {
  ThinkingSession,
  startThinking,
  getSessionThoughts,
  getRecentChannelThoughts,
  formatThoughts,
  type ThoughtType,
  type ThoughtContext,
  type ThoughtOptions,
  type Thought,
} from './thinking.js'

// Lookup Agent
export {
  LookupAgent,
  lookupAgent,
  classifyLookup,
  formatLookupResults,
  type LookupType,
  type SourceType,
  type LookupRequest,
  type LookupResult,
  type LookupAgentResult,
} from './lookup-agent.js'

// Smart Orchestrator - Main Agent
export {
  SmartOrchestrator,
  smartOrchestrator,
  processWithOrchestrator,
  type OrchestratorRequest,
  type OrchestratorResponse,
} from './smart-orchestrator.js'
