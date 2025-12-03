/**
 * @crit-fumble/fumblebot-browser-companion
 *
 * Browser companion components for FumbleBot - connect TTRPG virtual tabletops
 * to the Crit-Fumble platform.
 */

// Components
export { VTTStatusPanel } from './components/VTTStatusPanel';

// Types
export type {
  VTTPlatform,
  VTTConnectionState,
  VTTConnectionStatus,
  VTTRoll,
  VTTMessage,
  VTTSessionInfo,
  GameSystem,
} from './types';

// Utilities
export { createVTTBridge } from './utils/bridge';
export { parseRoll20Roll, parseDndBeyondRoll, parseFoundryRoll } from './utils/parsers';
export {
  convertToVTTRoll,
  analyzeD20Roll,
  detectGameSystem,
  parseDiceExpression,
  cleanRoll20Expression,
  ROLL_SELECTORS,
} from './utils/rollConverter';
