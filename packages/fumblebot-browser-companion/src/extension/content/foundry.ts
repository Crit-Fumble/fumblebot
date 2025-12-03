/**
 * Foundry VTT Content Script
 *
 * Monitors Foundry VTT for:
 * - Dice rolls (including Cypher System)
 * - Chat messages
 * - Game session information
 *
 * Supports game systems:
 * - D&D 5e
 * - Pathfinder 2e
 * - Cypher System (Numenera, The Strange, etc.)
 * - Call of Cthulhu
 * - Savage Worlds
 * - Generic
 */

import type { VTTRoll, VTTMessage, VTTSessionInfo, VTTEvent, GameSystem } from '../../types';
import {
  convertToVTTRoll,
  analyzeD20Roll,
  generateRollId,
  ROLL_SELECTORS,
} from '../../utils/rollConverter';

console.log('[FumbleBot] Foundry VTT content script loaded');

let sessionInfo: VTTSessionInfo | null = null;
let detectedGameSystem: GameSystem = 'generic';
let chatObserver: MutationObserver | null = null;

/**
 * Send event to background service worker
 */
function sendEvent(event: VTTEvent) {
  chrome.runtime.sendMessage({ type: 'VTT_EVENT', payload: event });
}

/**
 * Get Foundry's game object
 */
function getGameObject(): {
  world?: { id: string; title: string };
  user?: { id: string; name: string; isGM: boolean };
  users?: Map<string, { id: string; name: string; isGM: boolean; active: boolean }>;
  system?: { id: string; title: string };
  settings?: { get: (module: string, key: string) => unknown };
} | null {
  return (window as unknown as { game?: ReturnType<typeof getGameObject> }).game || null;
}

/**
 * Detect the game system being used
 */
function detectFoundryGameSystem(): GameSystem {
  const game = getGameObject();
  if (!game?.system?.id) return 'generic';

  const systemId = game.system.id.toLowerCase();

  // Cypher System variants
  if (systemId === 'cyphersystem' || systemId === 'cypher') return 'cypher';
  if (systemId === 'numenera') return 'cypher';
  if (systemId === 'thestrange') return 'cypher';

  // D&D 5e
  if (systemId === 'dnd5e') return 'dnd5e';

  // Pathfinder
  if (systemId === 'pf2e') return 'pf2e';

  // Call of Cthulhu
  if (systemId === 'coc7' || systemId === 'coc') return 'coc';

  // Savage Worlds
  if (systemId === 'swade') return 'swade';

  return 'generic';
}

/**
 * Extract session info from Foundry
 */
function extractSessionInfo(): VTTSessionInfo | null {
  try {
    const game = getGameObject();
    if (!game?.world || !game?.user) return null;

    // Detect game system
    detectedGameSystem = detectFoundryGameSystem();
    console.log(`[FumbleBot] Detected game system: ${detectedGameSystem}`);

    const players: VTTSessionInfo['players'] = [];
    if (game.users) {
      game.users.forEach((user) => {
        if (user.active) {
          players.push({
            id: user.id,
            name: user.name,
            isGM: user.isGM,
          });
        }
      });
    }

    return {
      platform: 'foundry',
      gameId: game.world.id,
      gameName: game.world.title,
      currentUser: {
        id: game.user.id,
        name: game.user.name,
        isGM: game.user.isGM,
      },
      players,
    };
  } catch (error) {
    console.error('[FumbleBot] Failed to extract Foundry session info:', error);
    return null;
  }
}

/**
 * Parse a Cypher System roll from DOM element
 */
function parseCypherRollFromDOM(element: Element): VTTRoll | null {
  try {
    // Cypher System module uses specific classes
    const rollElement = element.querySelector('.dice-roll, .cypher-roll');
    if (!rollElement) return null;

    // Get the formula
    const formula = element.querySelector('.dice-formula, .roll-formula')?.textContent?.trim() || 'd20';

    // Get total - Cypher rolls are always d20 based
    const totalEl = element.querySelector('.dice-total, .roll-total, .cypher-total');
    const total = parseInt(totalEl?.textContent || '0', 10);

    // Get individual dice results
    const diceElements = element.querySelectorAll('.die, .dice-result');
    const results: number[] = [];
    diceElements.forEach((die) => {
      const value = parseInt(die.textContent || '0', 10);
      if (!isNaN(value) && value > 0) results.push(value);
    });

    // If no individual results found, use total as the d20 result
    if (results.length === 0 && total > 0) {
      results.push(total);
    }

    // Analyze the d20 result for Cypher System effects
    const d20Result = results[0] || total;
    const { critical, fumble, cypherEffect } = analyzeD20Roll(d20Result, 'cypher');

    // Get roller info from message
    const messageContainer = element.closest('.chat-message');
    const rollerName = messageContainer?.querySelector('.message-sender')?.textContent?.trim() || 'Unknown';

    // Try to get the roll label/type
    const flavor = element.querySelector('.flavor-text, .roll-flavor')?.textContent?.trim();

    // Determine roll type for Cypher
    let rollType: VTTRoll['rollType'] = 'check';
    if (flavor) {
      const flavorLower = flavor.toLowerCase();
      if (flavorLower.includes('attack') || flavorLower.includes('combat')) rollType = 'attack';
      else if (flavorLower.includes('defense') || flavorLower.includes('speed defense')) rollType = 'save';
      else if (flavorLower.includes('initiative')) rollType = 'initiative';
    }

    return {
      id: generateRollId('foundry'),
      platform: 'foundry',
      gameSystem: 'cypher',
      timestamp: new Date(),
      roller: {
        id: messageContainer?.getAttribute('data-user-id') || 'unknown',
        name: rollerName,
      },
      expression: formula,
      results,
      total,
      label: flavor,
      rollType,
      critical,
      fumble,
      cypherEffect,
      raw: {
        html: element.innerHTML,
        system: 'cypher',
      },
    };
  } catch (error) {
    console.error('[FumbleBot] Failed to parse Cypher roll:', error);
    return null;
  }
}

/**
 * Parse a standard Foundry roll from DOM element
 */
function parseFoundryRollFromDOM(element: Element): VTTRoll | null {
  try {
    const rollElement = element.querySelector(ROLL_SELECTORS.foundry.rollResult);
    if (!rollElement) return null;

    // Get formula
    const formula = element.querySelector(ROLL_SELECTORS.foundry.formula)?.textContent?.trim() || '';

    // Get total
    const totalEl = element.querySelector(ROLL_SELECTORS.foundry.total);
    const total = parseInt(totalEl?.textContent || '0', 10);

    // Get individual dice results
    const diceElements = element.querySelectorAll(ROLL_SELECTORS.foundry.dice);
    const results: number[] = [];
    diceElements.forEach((die) => {
      const value = parseInt(die.textContent || '0', 10);
      if (!isNaN(value) && value > 0) results.push(value);
    });

    // Get roller info
    const messageContainer = element.closest('.chat-message');
    const rollerName = messageContainer?.querySelector('.message-sender')?.textContent?.trim() || 'Unknown';

    // Get flavor text
    const flavor = element.querySelector('.flavor-text')?.textContent?.trim();

    return convertToVTTRoll(
      'foundry',
      {
        expression: formula,
        results,
        total,
        rollerId: messageContainer?.getAttribute('data-user-id') || 'unknown',
        rollerName,
        label: flavor,
        raw: { html: element.innerHTML },
      },
      { systemId: detectedGameSystem }
    );
  } catch (error) {
    console.error('[FumbleBot] Failed to parse Foundry roll:', error);
    return null;
  }
}

/**
 * Handle new chat message (from MutationObserver)
 */
function handleNewChatMessage(element: Element) {
  // Check for Cypher System roll first
  if (detectedGameSystem === 'cypher') {
    const cypherRoll = parseCypherRollFromDOM(element);
    if (cypherRoll) {
      console.log('[FumbleBot] Detected Cypher roll:', cypherRoll);
      sendEvent({ type: 'roll', data: cypherRoll });
      return;
    }
  }

  // Check for standard roll
  if (element.querySelector(ROLL_SELECTORS.foundry.rollResult)) {
    const roll = parseFoundryRollFromDOM(element);
    if (roll) {
      console.log('[FumbleBot] Detected roll:', roll);
      sendEvent({ type: 'roll', data: roll });
      return;
    }
  }

  // Parse as regular chat message
  const content = element.querySelector('.message-content')?.textContent?.trim();
  if (!content) return;

  const senderName = element.querySelector('.message-sender')?.textContent?.trim() || 'Unknown';

  // Determine message type from Foundry's type attribute
  const typeAttr = element.getAttribute('data-message-type');
  let type: VTTMessage['type'] = 'chat';
  if (typeAttr === '3') type = 'emote';
  if (typeAttr === '4') type = 'whisper';
  if (typeAttr === '0') type = 'system';

  const message: VTTMessage = {
    id: `foundry-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    platform: 'foundry',
    timestamp: new Date(),
    sender: {
      id: element.getAttribute('data-user-id') || 'unknown',
      name: senderName,
    },
    content,
    type,
    raw: { html: element.innerHTML },
  };

  sendEvent({ type: 'message', data: message });
}

/**
 * Start observing the chat log for new messages
 * Uses MutationObserver pattern from dddice/Beyond20
 */
function startChatObserver() {
  const chatLog = document.querySelector(ROLL_SELECTORS.foundry.chat);
  if (!chatLog) {
    console.log('[FumbleBot] Chat log not found, retrying...');
    setTimeout(startChatObserver, 1000);
    return;
  }

  if (chatObserver) {
    chatObserver.disconnect();
  }

  chatObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element && node.classList.contains('chat-message')) {
          handleNewChatMessage(node);
        }
      }
    }
  });

  chatObserver.observe(chatLog, { childList: true, subtree: true });
  console.log('[FumbleBot] Chat observer started for Foundry VTT');
}

/**
 * Hook into Foundry's native Hooks system for better integration
 */
function hookFoundryNative() {
  const Hooks = (window as unknown as {
    Hooks?: {
      on: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }).Hooks;

  if (!Hooks?.on) {
    console.log('[FumbleBot] Foundry Hooks not available, using DOM observer only');
    return;
  }

  // Hook into chat message creation for more reliable roll detection
  Hooks.on('createChatMessage', (rawMessage: unknown) => {
    const message = rawMessage as {
      id: string;
      type: number;
      user: { id: string; name: string };
      speaker?: { alias?: string };
      content: string;
      rolls?: unknown[];
      flavor?: string;
      timestamp: number;
    };
    console.log('[FumbleBot] Foundry createChatMessage hook:', message);

    // Check if this is a roll
    if (message.rolls && message.rolls.length > 0) {
      const rollData = message.rolls[0] as {
        formula?: string;
        total?: number;
        terms?: Array<{ results?: Array<{ result: number }> }>;
        options?: { flavor?: string };
      };

      // Extract dice results
      const results: number[] = [];
      rollData.terms?.forEach((term) => {
        term.results?.forEach((r) => {
          if (typeof r.result === 'number') results.push(r.result);
        });
      });

      const roll = convertToVTTRoll(
        'foundry',
        {
          expression: rollData.formula || '',
          results,
          total: rollData.total || 0,
          rollerId: message.user?.id,
          rollerName: message.user?.name || message.speaker?.alias,
          characterName: message.speaker?.alias,
          label: message.flavor || rollData.options?.flavor,
          raw: message,
        },
        { systemId: detectedGameSystem }
      );

      // For Cypher System, re-analyze for special effects
      if (detectedGameSystem === 'cypher' && results.length > 0) {
        const analysis = analyzeD20Roll(results[0], 'cypher');
        roll.critical = analysis.critical;
        roll.fumble = analysis.fumble;
        roll.cypherEffect = analysis.cypherEffect;
        roll.gameSystem = 'cypher';
      }

      sendEvent({ type: 'roll', data: roll });
    }
  });

  console.log('[FumbleBot] Hooked into Foundry native Hooks');
}

/**
 * Initialize the content script
 */
function init() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
    return;
  }

  // Wait for Foundry to fully load
  const waitForGame = () => {
    const game = getGameObject();
    if (game?.world) {
      sessionInfo = extractSessionInfo();
      if (sessionInfo) {
        sendEvent({ type: 'connected', data: sessionInfo });
        console.log('[FumbleBot] Connected to Foundry VTT:', sessionInfo.gameName);
      }

      // Try native hooks first, also use DOM observer as backup
      hookFoundryNative();
      startChatObserver();
    } else {
      setTimeout(waitForGame, 1000);
    }
  };

  waitForGame();
}

init();
