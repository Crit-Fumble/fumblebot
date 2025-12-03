/**
 * Extension-specific exports
 *
 * This module provides types and utilities for browser extension development.
 */

export type {
  VTTPlatform,
  VTTConnectionState,
  VTTConnectionStatus,
  VTTRoll,
  VTTMessage,
  VTTSessionInfo,
  VTTEvent,
  ExtensionMessage,
} from '../types';

export { parseRoll20Roll, parseDndBeyondRoll, parseFoundryRoll, parseUnknownRoll } from '../utils/parsers';
