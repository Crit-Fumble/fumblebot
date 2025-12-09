/**
 * Adventure Terminal Service
 * MUD-style text adventure management via Core API
 */

// New Adventure API service (preferred)
export {
  default as adventureService,
  AdventureService,
} from './adventure-service.js';
export type {
  AdventureSession,
  SendMessageResult,
  Adventure,
  AdventureSummary,
  AdventureMessage,
  AdventurePlayer,
  AdventureRole,
  AdventureStatus,
  AdventureMessageType,
} from './adventure-service.js';

// Legacy terminal service (container-based)
export { default as terminalService, TerminalService } from './terminal-service.js';
export type { TerminalSession, TerminalExecResult } from './terminal-service.js';

// Output formatters
export {
  formatTerminalOutput,
  formatTerminalStatus,
  formatSessionList,
  formatAdventureMessage,
  formatAdventureStatus,
  formatAdventureHistory,
} from './output-formatter.js';
