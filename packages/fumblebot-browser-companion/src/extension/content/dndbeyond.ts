/**
 * D&D Beyond Content Script
 *
 * Monitors D&D Beyond for:
 * - Dice rolls from the dice roller
 * - Character sheet information
 */

import type { VTTRoll, VTTSessionInfo, VTTEvent } from '../../types';

console.log('[FumbleBot] D&D Beyond content script loaded');

let sessionInfo: VTTSessionInfo | null = null;

/**
 * Send event to background service worker
 */
function sendEvent(event: VTTEvent) {
  chrome.runtime.sendMessage({ type: 'VTT_EVENT', payload: event });
}

/**
 * Extract character/campaign info from D&D Beyond page
 */
function extractSessionInfo(): VTTSessionInfo | null {
  try {
    // Check if we're on a character sheet
    const characterNameEl = document.querySelector('.ddbc-character-name');
    const characterId = window.location.pathname.match(/\/characters\/(\d+)/)?.[1];

    if (!characterId) {
      // Check if we're in a campaign
      const campaignId = window.location.pathname.match(/\/campaigns\/(\d+)/)?.[1];
      if (!campaignId) return null;

      const campaignName =
        document.querySelector('.campaign-header-name')?.textContent?.trim() || 'Unknown Campaign';

      return {
        platform: 'dndbeyond',
        gameId: campaignId,
        gameName: campaignName,
        currentUser: {
          id: 'unknown',
          name: 'Unknown',
          isGM: false,
        },
        players: [],
      };
    }

    const characterName = characterNameEl?.textContent?.trim() || 'Unknown Character';

    return {
      platform: 'dndbeyond',
      gameId: characterId,
      gameName: characterName,
      currentUser: {
        id: characterId,
        name: characterName,
        isGM: false,
      },
      players: [
        {
          id: characterId,
          name: characterName,
          isGM: false,
        },
      ],
    };
  } catch (error) {
    console.error('[FumbleBot] Failed to extract D&D Beyond session info:', error);
    return null;
  }
}

/**
 * Parse D&D Beyond dice roll notification
 */
function parseDiceRoll(rollData: {
  diceNotation?: string;
  total?: number;
  rolls?: Array<{ result: number }>;
  rollType?: string;
  rollKind?: string;
}): VTTRoll | null {
  try {
    const results = rollData.rolls?.map((r) => r.result) || [];

    // Determine roll type
    let rollType: VTTRoll['rollType'];
    switch (rollData.rollType?.toLowerCase()) {
      case 'attack':
        rollType = 'attack';
        break;
      case 'damage':
        rollType = 'damage';
        break;
      case 'save':
      case 'saving-throw':
        rollType = 'save';
        break;
      case 'check':
      case 'ability':
        rollType = 'check';
        break;
      default:
        rollType = 'custom';
    }

    // Check for advantage/disadvantage
    const isCritical =
      rollData.rollKind === 'critical' ||
      (results.length > 0 && results[0] === 20 && rollType === 'attack');
    const isFumble = results.length > 0 && results[0] === 1 && rollType === 'attack';

    return {
      id: `dndbeyond-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      platform: 'dndbeyond',
      timestamp: new Date(),
      roller: {
        id: sessionInfo?.currentUser.id || 'unknown',
        name: sessionInfo?.currentUser.name || 'Unknown',
      },
      expression: rollData.diceNotation || 'Unknown',
      results,
      total: rollData.total || 0,
      rollType,
      critical: isCritical,
      fumble: isFumble,
      characterName: sessionInfo?.gameName,
      raw: rollData,
    };
  } catch (error) {
    console.error('[FumbleBot] Failed to parse D&D Beyond roll:', error);
    return null;
  }
}

/**
 * Intercept D&D Beyond dice roller
 */
function interceptDiceRoller() {
  // D&D Beyond uses a dice notification system
  // We'll watch for DOM changes in the dice tray/notification area

  const diceObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          // Look for dice roll results
          const rollResult = node.querySelector('.dice_result, .dice-toolbar__result');
          if (rollResult) {
            // Extract roll data from the result element
            const total = parseInt(rollResult.textContent || '0', 10);
            const notation =
              node.querySelector('.dice_notation, .dice-toolbar__notation')?.textContent || '';

            // Get individual dice
            const diceElements = node.querySelectorAll('.die_result, .dice-toolbar__die');
            const results = Array.from(diceElements).map((el) =>
              parseInt(el.textContent || '0', 10)
            );

            const roll = parseDiceRoll({
              diceNotation: notation,
              total,
              rolls: results.map((r) => ({ result: r })),
            });

            if (roll) {
              sendEvent({ type: 'roll', data: roll });
            }
          }
        }
      }
    }
  });

  // Observe the body for dice notifications
  diceObserver.observe(document.body, { childList: true, subtree: true });

  // Also try to intercept the window.diceRoller if available
  const checkForDiceRoller = () => {
    const diceRoller = (window as unknown as { diceRoller?: { on?: (event: string, callback: (data: unknown) => void) => void } }).diceRoller;
    if (diceRoller?.on) {
      diceRoller.on('roll', (data: unknown) => {
        const roll = parseDiceRoll(data as Parameters<typeof parseDiceRoll>[0]);
        if (roll) {
          sendEvent({ type: 'roll', data: roll });
        }
      });
      console.log('[FumbleBot] Hooked into D&D Beyond dice roller');
    } else {
      setTimeout(checkForDiceRoller, 1000);
    }
  };

  checkForDiceRoller();
}

/**
 * Initialize the content script
 */
function init() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
    return;
  }

  sessionInfo = extractSessionInfo();
  if (sessionInfo) {
    sendEvent({ type: 'connected', data: sessionInfo });
  }

  interceptDiceRoller();

  // Re-check session info on navigation
  const observer = new MutationObserver(() => {
    const newInfo = extractSessionInfo();
    if (newInfo && JSON.stringify(newInfo) !== JSON.stringify(sessionInfo)) {
      sessionInfo = newInfo;
      sendEvent({ type: 'connected', data: sessionInfo });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

init();
