/**
 * Cypher Tools Content Script (tools.cypher-system.com)
 *
 * Monitors Cypher System character builder for:
 * - Dice rolls from character sheets
 * - Character information
 * - Roll modifiers and pools
 *
 * Cypher System uses a d20 task resolution system with special effects:
 * - 1: GM Intrusion
 * - 17: Minor Effect
 * - 18-19: Major Effect
 * - 20: Major Effect + Free Intrusion
 */

import type { VTTRoll, VTTMessage, VTTSessionInfo, VTTEvent } from '../../types';
import { convertToVTTRoll, analyzeD20Roll, generateRollId } from '../../utils/rollConverter';

console.log('[FumbleBot] Cypher Tools content script loaded');

let sessionInfo: VTTSessionInfo | null = null;
let rollObserver: MutationObserver | null = null;

/**
 * Send event to background service worker
 */
function sendEvent(event: VTTEvent) {
  chrome.runtime.sendMessage({ type: 'VTT_EVENT', payload: event });
}

/**
 * Extract character info from the page
 */
function extractCharacterInfo(): { name: string; tier?: number; pools?: { might: number; speed: number; intellect: number } } | null {
  try {
    // Try to find character name from common locations
    const nameEl = document.querySelector(
      '.character-name, [class*="character-name"], [data-character-name], .char-name, #character-name, h1.name'
    );
    const name = nameEl?.textContent?.trim();

    if (!name) return null;

    // Try to extract tier
    const tierEl = document.querySelector('.tier, [class*="tier"], [data-tier]');
    const tier = tierEl ? parseInt(tierEl.textContent || '1', 10) : undefined;

    // Try to extract pools (Might, Speed, Intellect)
    const mightEl = document.querySelector('[class*="might"] .pool-value, [data-pool="might"]');
    const speedEl = document.querySelector('[class*="speed"] .pool-value, [data-pool="speed"]');
    const intellectEl = document.querySelector('[class*="intellect"] .pool-value, [data-pool="intellect"]');

    const pools = {
      might: parseInt(mightEl?.textContent || '0', 10),
      speed: parseInt(speedEl?.textContent || '0', 10),
      intellect: parseInt(intellectEl?.textContent || '0', 10),
    };

    return { name, tier, pools };
  } catch (error) {
    console.error('[FumbleBot] Failed to extract character info:', error);
    return null;
  }
}

/**
 * Extract session info
 */
function extractSessionInfo(): VTTSessionInfo | null {
  try {
    // Get user info if logged in
    const userEl = document.querySelector(
      '.user-name, [class*="username"], .account-name, [data-user]'
    );
    const userName = userEl?.textContent?.trim() || 'Guest';

    // Get character info
    const character = extractCharacterInfo();

    return {
      platform: 'foundry', // Using foundry as VTTPlatform for now (Cypher-specific)
      gameId: `cypher-tools-${Date.now()}`,
      gameName: character?.name ? `Cypher Tools: ${character.name}` : 'Cypher Tools',
      currentUser: {
        id: 'cypher-tools-user',
        name: userName,
        isGM: false,
      },
      players: [{
        id: 'cypher-tools-user',
        name: userName,
        isGM: false,
      }],
    };
  } catch (error) {
    console.error('[FumbleBot] Failed to extract session info:', error);
    return null;
  }
}

/**
 * Parse a roll result from the page
 * Cypher Tools may display rolls in various formats
 */
function parseRollElement(element: Element): VTTRoll | null {
  try {
    // Look for d20 roll result
    const resultEl = element.querySelector(
      '.roll-result, .dice-result, [class*="roll"], .d20-result, [data-roll-result]'
    );
    if (!resultEl) return null;

    const rollValue = parseInt(resultEl.textContent || '0', 10);
    if (isNaN(rollValue) || rollValue < 1 || rollValue > 20) return null;

    // Get roll context/label
    const labelEl = element.querySelector(
      '.roll-label, .roll-type, [class*="roll-name"], .skill-name, .action-name'
    );
    const label = labelEl?.textContent?.trim();

    // Determine roll type
    let rollType: VTTRoll['rollType'] = 'check';
    if (label) {
      const labelLower = label.toLowerCase();
      if (labelLower.includes('attack') || labelLower.includes('combat')) rollType = 'attack';
      else if (labelLower.includes('defense') || labelLower.includes('speed defense')) rollType = 'save';
      else if (labelLower.includes('initiative')) rollType = 'initiative';
    }

    // Analyze for Cypher System effects
    const analysis = analyzeD20Roll(rollValue, 'cypher');

    // Get character info for context
    const character = extractCharacterInfo();

    return {
      id: generateRollId('foundry'),
      platform: 'foundry', // Using foundry as we don't have 'cypher-tools' in VTTPlatform
      gameSystem: 'cypher',
      timestamp: new Date(),
      roller: {
        id: 'cypher-tools-user',
        name: character?.name || 'Player',
      },
      expression: '1d20',
      results: [rollValue],
      total: rollValue,
      label,
      characterName: character?.name,
      rollType,
      critical: analysis.critical,
      fumble: analysis.fumble,
      cypherEffect: analysis.cypherEffect,
      raw: {
        html: element.innerHTML,
        source: 'cypher-tools',
        character,
      },
    };
  } catch (error) {
    console.error('[FumbleBot] Failed to parse Cypher roll:', error);
    return null;
  }
}

/**
 * Handle click events that might trigger rolls
 */
function handleRollClick(event: Event) {
  const target = event.target as Element;

  // Look for roll buttons/links
  const rollButton = target.closest(
    '[class*="roll"], [data-action="roll"], .dice-button, .roll-button, button[class*="dice"]'
  );

  if (rollButton) {
    // Wait for the roll result to appear
    setTimeout(() => {
      // Look for roll result container
      const resultContainer = document.querySelector(
        '.roll-output, .dice-output, [class*="roll-result"], .roll-container, .modal.roll'
      );

      if (resultContainer) {
        const roll = parseRollElement(resultContainer);
        if (roll) {
          console.log('[FumbleBot] Detected Cypher roll from click:', roll);
          sendEvent({ type: 'roll', data: roll });
        }
      }
    }, 500);
  }
}

/**
 * Start observing for roll results
 * Uses MutationObserver to catch dynamically added roll results
 */
function startRollObserver() {
  // Find the main content area where rolls might appear
  const contentAreas = [
    document.body,
    document.querySelector('.app, #app, .main, #main, .content'),
  ].filter(Boolean);

  const targetNode = contentAreas[1] || contentAreas[0];
  if (!targetNode) {
    console.log('[FumbleBot] Content area not found, retrying...');
    setTimeout(startRollObserver, 1000);
    return;
  }

  if (rollObserver) {
    rollObserver.disconnect();
  }

  rollObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          // Check if this is a roll result
          if (
            node.matches('.roll-result, .dice-result, [class*="roll-output"], .roll-modal') ||
            node.querySelector('.roll-result, .dice-result, [class*="roll-output"]')
          ) {
            const roll = parseRollElement(node);
            if (roll) {
              console.log('[FumbleBot] Detected Cypher roll from mutation:', roll);
              sendEvent({ type: 'roll', data: roll });
            }
          }

          // Also check for toast/notification style roll results
          if (node.matches('.toast, .notification, [class*="toast"], [class*="notification"]')) {
            const resultText = node.textContent;
            const d20Match = resultText?.match(/(?:rolled?|result)[:\s]*(\d+)/i);
            if (d20Match) {
              const rollValue = parseInt(d20Match[1], 10);
              if (rollValue >= 1 && rollValue <= 20) {
                const analysis = analyzeD20Roll(rollValue, 'cypher');
                const character = extractCharacterInfo();

                const roll: VTTRoll = {
                  id: generateRollId('foundry'),
                  platform: 'foundry',
                  gameSystem: 'cypher',
                  timestamp: new Date(),
                  roller: {
                    id: 'cypher-tools-user',
                    name: character?.name || 'Player',
                  },
                  expression: '1d20',
                  results: [rollValue],
                  total: rollValue,
                  characterName: character?.name,
                  rollType: 'check',
                  critical: analysis.critical,
                  fumble: analysis.fumble,
                  cypherEffect: analysis.cypherEffect,
                  raw: { text: resultText, source: 'cypher-tools-notification' },
                };

                console.log('[FumbleBot] Detected Cypher roll from notification:', roll);
                sendEvent({ type: 'roll', data: roll });
              }
            }
          }
        }
      }
    }
  });

  rollObserver.observe(targetNode, { childList: true, subtree: true });
  console.log('[FumbleBot] Roll observer started for Cypher Tools');
}

/**
 * Initialize the content script
 */
function init() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
    return;
  }

  // Extract session info
  sessionInfo = extractSessionInfo();
  if (sessionInfo) {
    sendEvent({ type: 'connected', data: sessionInfo });
    console.log('[FumbleBot] Connected to Cypher Tools');
  }

  // Start observing for rolls
  startRollObserver();

  // Listen for roll button clicks
  document.addEventListener('click', handleRollClick, true);

  // Update session info when character changes
  const observer = new MutationObserver(() => {
    const newInfo = extractSessionInfo();
    if (newInfo && JSON.stringify(newInfo) !== JSON.stringify(sessionInfo)) {
      sessionInfo = newInfo;
      sendEvent({ type: 'connected', data: sessionInfo });
      console.log('[FumbleBot] Session info updated');
    }
  });

  // Observe character sheet area for changes
  const charSheet = document.querySelector('.character-sheet, [class*="character"], #character');
  if (charSheet) {
    observer.observe(charSheet, { childList: true, subtree: true, characterData: true });
  }
}

init();
