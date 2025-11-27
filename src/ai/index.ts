/**
 * AI Module
 * Exports AI-related functionality
 *
 * Three layers:
 * 1. AIService - Direct API calls to OpenAI/Anthropic
 * 2. ScriptedContent - Pre-generated content cached for reuse
 */

export { AIService } from './service.js'
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
