/**
 * Roll20 Content Script
 *
 * Monitors the Roll20 game interface for:
 * - Dice rolls in chat (including roll templates)
 * - Chat messages
 * - Player/character information
 *
 * Patterns inspired by Beyond20 and dddice extensions.
 *
 * Supports game systems:
 * - D&D 5e (OGL, Shaped, 2024)
 * - Pathfinder 2e
 * - Cypher System
 * - Call of Cthulhu
 * - Generic
 */

import type { VTTRoll, VTTMessage, VTTSessionInfo, VTTEvent, GameSystem } from '../../types';
import {
  convertToVTTRoll,
  analyzeD20Roll,
  cleanRoll20Expression,
  ROLL_SELECTORS,
} from '../../utils/rollConverter';

console.log('[FumbleBot] Roll20 content script loaded');

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
 * Detect the game system from Roll20 character sheet type
 * Based on Beyond20's approach
 */
function detectRoll20GameSystem(): GameSystem {
  // Check for sheet type indicators in the DOM
  const sheetIndicators = [
    { selector: '[class*="sheet-5e"], [class*="sheet-dnd5e"]', system: 'dnd5e' as GameSystem },
    { selector: '[class*="sheet-shaped"]', system: 'dnd5e' as GameSystem },
    { selector: '[class*="sheet-2024"], .dnd-2024--roll', system: 'dnd5e-2024' as GameSystem },
    { selector: '[class*="sheet-pf2e"], [class*="sheet-pathfinder"]', system: 'pf2e' as GameSystem },
    { selector: '[class*="sheet-cypher"], [class*="sheet-numenera"]', system: 'cypher' as GameSystem },
    { selector: '[class*="sheet-coc"], .sheet-coc-roll__container', system: 'coc' as GameSystem },
  ];

  for (const { selector, system } of sheetIndicators) {
    if (document.querySelector(selector)) {
      return system;
    }
  }

  // Check roll templates in existing chat messages
  const chatMessages = document.querySelectorAll('#textchat .message');
  for (const msg of chatMessages) {
    const html = msg.innerHTML.toLowerCase();
    if (html.includes('cypher') || html.includes('numenera')) return 'cypher';
    if (html.includes('rolltemplate:5e') || html.includes('rolltemplate:npc')) return 'dnd5e';
    if (html.includes('rolltemplate:pf2e')) return 'pf2e';
    if (html.includes('rolltemplate:coc')) return 'coc';
  }

  return 'generic';
}

/**
 * Extract session info from Roll20 page
 */
function extractSessionInfo(): VTTSessionInfo | null {
  try {
    // Roll20 stores campaign info in URL
    const campaignId = window.location.pathname.match(/\/editor\/([^/]+)/)?.[1];
    if (!campaignId) return null;

    // Detect game system
    detectedGameSystem = detectRoll20GameSystem();
    console.log(`[FumbleBot] Detected game system: ${detectedGameSystem}`);

    // Try to get campaign name from page title or DOM
    const campaignName =
      document.querySelector('#campaignname')?.textContent ||
      document.title.replace(' | Roll20', '').trim() ||
      'Unknown Campaign';

    // Get current user info - Roll20 exposes this in various ways
    const win = window as unknown as {
      d20_player_id?: string;
      d20_player_name?: string;
      Campaign?: { players?: Map<string, { displayname: string; isGM: boolean }> };
    };

    const currentUserId = win.d20_player_id || 'unknown';
    const currentUserName =
      document.querySelector('.player.self .name')?.textContent ||
      win.d20_player_name ||
      'Unknown Player';

    // Check if current user is GM
    const isGM = !!document.querySelector('.player.self.gm');

    // Get list of players
    const playerElements = document.querySelectorAll('.player');
    const players = Array.from(playerElements).map((el) => ({
      id: el.getAttribute('data-playerid') || 'unknown',
      name: el.querySelector('.name')?.textContent || 'Unknown',
      isGM: el.classList.contains('gm'),
    }));

    return {
      platform: 'roll20',
      gameId: campaignId,
      gameName: campaignName,
      currentUser: {
        id: currentUserId,
        name: currentUserName,
        isGM,
      },
      players,
    };
  } catch (error) {
    console.error('[FumbleBot] Failed to extract session info:', error);
    return null;
  }
}

/**
 * Determine roll type from Roll20 roll template or context
 * Based on Beyond20's classification
 */
function classifyRollType(element: Element): VTTRoll['rollType'] {
  const html = element.innerHTML.toLowerCase();
  const classes = element.className.toLowerCase();

  // Check roll template classes and content
  if (html.includes('attack') || classes.includes('attack')) return 'attack';
  if (html.includes('damage') || classes.includes('damage')) return 'damage';
  if (html.includes('saving') || html.includes('save') || classes.includes('save')) return 'save';
  if (html.includes('initiative') || classes.includes('initiative')) return 'initiative';
  if (html.includes('skill') || classes.includes('skill')) return 'skill';
  if (html.includes('ability') || html.includes('check') || classes.includes('ability')) return 'ability';

  return 'custom';
}

/**
 * Parse a Roll20 roll message
 * Enhanced with Beyond20/dddice patterns
 */
function parseRollMessage(element: Element): VTTRoll | null {
  try {
    // Check various roll result selectors (from dddice)
    const rollResult = element.querySelector(
      ROLL_SELECTORS.roll20.inlineRoll + ', ' +
      '.rollresult, .diceroll, .d20'
    );
    if (!rollResult) return null;

    // Get formula - try multiple locations
    let formula = element.querySelector(ROLL_SELECTORS.roll20.formula)?.textContent || '';
    if (!formula) {
      // Try to extract from title attribute
      formula = rollResult.getAttribute('title') || rollResult.getAttribute('original-title') || '';
    }
    formula = cleanRoll20Expression(formula);

    // Get total - check multiple sources
    let total = 0;
    const dataRoll = rollResult.getAttribute('data-roll');
    if (dataRoll) {
      total = parseInt(dataRoll, 10);
    } else {
      const totalText = rollResult.textContent?.match(/=?\s*(\d+)\s*$/)?.[1];
      total = totalText ? parseInt(totalText, 10) : 0;
    }

    // Get individual dice results - enhanced selectors
    const diceResults: number[] = [];

    // Method 1: .dicegrouping .basicdiceroll (standard)
    element.querySelectorAll('.dicegrouping .basicdiceroll, .diceroll .didroll').forEach((die) => {
      const value = parseInt(die.textContent || '0', 10);
      if (!isNaN(value) && value > 0) diceResults.push(value);
    });

    // Method 2: Parse from formula result if needed
    if (diceResults.length === 0) {
      const diceMatch = rollResult.textContent?.match(/\(([^)]+)\)/);
      if (diceMatch) {
        const diceStr = diceMatch[1];
        diceStr.split('+').forEach((part) => {
          const num = parseInt(part.trim(), 10);
          if (!isNaN(num)) diceResults.push(num);
        });
      }
    }

    // Get roller info
    const messageContainer = element.closest('.message') || element;
    const rollerName =
      messageContainer.querySelector('.by')?.textContent?.replace(':', '').trim() || 'Unknown';
    const rollerId = messageContainer.getAttribute('data-playerid') || 'unknown';

    // Check for critical/fumble - enhanced detection
    const classList = rollResult.className || '';
    let isCritical = classList.includes('fullcrit') || classList.includes('crit-success');
    let isFumble = classList.includes('fullfail') || classList.includes('crit-fail');

    // For d20 rolls, check the actual value
    if (diceResults.length > 0 && formula.includes('d20')) {
      const d20Result = diceResults[0];
      const analysis = analyzeD20Roll(d20Result, detectedGameSystem);
      isCritical = isCritical || analysis.critical;
      isFumble = isFumble || analysis.fumble;
    }

    // Get roll label from roll template
    const label =
      element.querySelector('.sheet-label, .sheet-rollname, [class*="header"], [class*="name"]')?.textContent?.trim() ||
      element.querySelector('.inlinerollresult')?.getAttribute('title')?.split('Rolling')[0]?.trim();

    // Get character name if available
    const characterName =
      element.querySelector('.charname, [class*="charname"]')?.textContent?.trim();

    // Classify the roll type
    const rollType = classifyRollType(element);

    const roll = convertToVTTRoll(
      'roll20',
      {
        expression: formula,
        results: diceResults,
        total,
        rollerId,
        rollerName,
        characterName,
        label,
        rollType,
        raw: { html: element.innerHTML },
      },
      { systemId: detectedGameSystem, rollTemplate: label }
    );

    // Override critical/fumble from our detection
    roll.critical = isCritical;
    roll.fumble = isFumble;

    // Handle Cypher System special effects
    if (detectedGameSystem === 'cypher' && diceResults.length > 0) {
      const analysis = analyzeD20Roll(diceResults[0], 'cypher');
      roll.cypherEffect = analysis.cypherEffect;
    }

    return roll;
  } catch (error) {
    console.error('[FumbleBot] Failed to parse roll:', error);
    return null;
  }
}

/**
 * Parse a chat message
 */
function parseChatMessage(element: Element): VTTMessage | null {
  try {
    // Skip roll messages
    if (element.querySelector('.inlinerollresult, .rollresult, .diceroll')) return null;

    const content =
      element.querySelector('.message-content, [class*="content"]')?.textContent?.trim();
    if (!content) return null;

    const senderName =
      element.querySelector('.by')?.textContent?.replace(':', '').trim() || 'Unknown';

    // Determine message type
    let type: VTTMessage['type'] = 'chat';
    const classList = element.className.toLowerCase();
    if (classList.includes('emote')) type = 'emote';
    if (classList.includes('whisper')) type = 'whisper';
    if (classList.includes('system') || classList.includes('general')) type = 'system';

    const characterName = element.querySelector('.charname')?.textContent?.trim();

    return {
      id: `roll20-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      platform: 'roll20',
      timestamp: new Date(),
      sender: {
        id: element.getAttribute('data-playerid') || 'unknown',
        name: senderName,
      },
      content,
      type,
      characterName,
      raw: { html: element.innerHTML },
    };
  } catch (error) {
    console.error('[FumbleBot] Failed to parse message:', error);
    return null;
  }
}

/**
 * Handle new chat entries
 */
function handleNewChatEntry(element: Element) {
  // Check if it's a roll
  const roll = parseRollMessage(element);
  if (roll) {
    console.log('[FumbleBot] Detected roll:', roll);
    sendEvent({ type: 'roll', data: roll });
    return;
  }

  // Check if it's a regular message
  const message = parseChatMessage(element);
  if (message) {
    sendEvent({ type: 'message', data: message });
  }
}

/**
 * Start observing the chat for new messages
 * Uses MutationObserver pattern from dddice
 */
function startChatObserver() {
  const chatContainer = document.querySelector(ROLL_SELECTORS.roll20.chat);
  if (!chatContainer) {
    console.log('[FumbleBot] Chat container not found, retrying...');
    setTimeout(startChatObserver, 1000);
    return;
  }

  if (chatObserver) {
    chatObserver.disconnect();
  }

  chatObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          // Check if this is a message or contains messages
          if (node.classList.contains('message')) {
            handleNewChatEntry(node);
          } else {
            // Check for nested messages (some roll templates)
            node.querySelectorAll('.message').forEach(handleNewChatEntry);
          }
        }
      }
    }
  });

  chatObserver.observe(chatContainer, { childList: true, subtree: true });
  console.log('[FumbleBot] Chat observer started for Roll20');
}

/**
 * Listen for messages from background script (Discord -> VTT relay)
 */
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'DISCORD_MESSAGE') {
    // Inject message into Roll20 chat
    // This requires using Roll20's API which may not be directly accessible
    console.log('[FumbleBot] Received Discord message to relay:', message.data);
  }
});

/**
 * Initialize the content script
 */
function init() {
  // Wait for the page to fully load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
    return;
  }

  // Extract session info
  sessionInfo = extractSessionInfo();
  if (sessionInfo) {
    sendEvent({ type: 'connected', data: sessionInfo });
    console.log('[FumbleBot] Connected to Roll20:', sessionInfo.gameName);
  }

  // Start monitoring chat
  startChatObserver();

  // Re-check session info periodically (players may join/leave)
  setInterval(() => {
    const newInfo = extractSessionInfo();
    if (newInfo && JSON.stringify(newInfo) !== JSON.stringify(sessionInfo)) {
      sessionInfo = newInfo;
      sendEvent({ type: 'connected', data: sessionInfo });
    }
  }, 30000);

  // Re-detect game system when character sheets are opened
  document.addEventListener('click', (e) => {
    const target = e.target as Element;
    if (target.closest('.charsheet, .character-button')) {
      setTimeout(() => {
        const newSystem = detectRoll20GameSystem();
        if (newSystem !== detectedGameSystem) {
          detectedGameSystem = newSystem;
          console.log(`[FumbleBot] Game system updated: ${detectedGameSystem}`);
        }
      }, 1000);
    }
  });
}

init();
