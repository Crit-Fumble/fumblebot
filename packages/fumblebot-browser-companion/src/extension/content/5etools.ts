/**
 * 5e.tools Content Script
 *
 * Monitors 5e.tools for:
 * - Dice rolls from stat blocks (attack rolls, damage, saves)
 * - Dice rolls from spell descriptions
 * - Inline dice roller results
 *
 * Based on 5etools source code analysis:
 * - Roller container: .rollbox, .rollbox-panel
 * - Roll results: .out-roll, .out-roll-item
 * - Clickable dice: [data-packed-dice]
 * - Input: .ipt-roll
 *
 * 5e.tools is a comprehensive D&D 5e reference tool that includes
 * clickable dice notation in stat blocks and spell descriptions.
 */

import type { VTTRoll, VTTSessionInfo, VTTEvent } from '../../types';
import {
  analyzeD20Roll,
  generateRollId,
} from '../../utils/rollConverter';

/**
 * 5etools-specific DOM selectors (from render-dice.js)
 */
const SELECTORS = {
  // Main containers
  rollbox: '.rollbox, .rollbox-panel',
  rollboxMin: '.rollbox-min',

  // Roll output
  outRoll: '.out-roll',
  outRollItem: '.out-roll-item',
  outRollItemCode: '.out-roll-item-code',

  // Clickable dice elements
  packedDice: '[data-packed-dice]',
  rollInput: '.ipt-roll',

  // Visual states
  rollMax: '.roll-max, .rll__max--muted',
  rollMin: '.roll-min, .rll__min--muted',
  dropped: '.rll__dropped',
  exploded: '.rll__exploded',

  // Table rolling
  rollerTable: '[data-rd-isroller]',
  tableRollRange: '[data-roll-min][data-roll-max]',

  // DC display
  dcValue: '.rd__dc',
};

console.log('[FumbleBot] 5e.tools content script loaded');

let sessionInfo: VTTSessionInfo | null = null;
let rollObserver: MutationObserver | null = null;

/**
 * Send event to background service worker
 */
function sendEvent(event: VTTEvent) {
  chrome.runtime.sendMessage({ type: 'VTT_EVENT', payload: event });
}

/**
 * Detect if we're on a specific page type
 */
function detectPageType(): string {
  const path = window.location.pathname;

  if (path.includes('bestiary')) return 'bestiary';
  if (path.includes('spells')) return 'spells';
  if (path.includes('items')) return 'items';
  if (path.includes('classes')) return 'classes';
  if (path.includes('races') || path.includes('species')) return 'races';
  if (path.includes('feats')) return 'feats';
  if (path.includes('backgrounds')) return 'backgrounds';

  return 'general';
}

/**
 * Extract context about what's being viewed
 * (monster name, spell name, etc.)
 */
function extractViewContext(): { name: string; type: string } | null {
  try {
    // Try to get the current entry name
    const nameEl = document.querySelector(
      '.stats-name, .stat-name, h1.entry-title, .name, [data-name], th.name, .mon-name'
    );
    const name = nameEl?.textContent?.trim();

    if (!name) return null;

    const type = detectPageType();
    return { name, type };
  } catch {
    return null;
  }
}

/**
 * Extract session info
 */
function extractSessionInfo(): VTTSessionInfo {
  const pageType = detectPageType();
  const context = extractViewContext();

  let gameName = '5e.tools';
  if (context) {
    gameName = `5e.tools - ${context.name}`;
  } else if (pageType !== 'general') {
    gameName = `5e.tools - ${pageType.charAt(0).toUpperCase() + pageType.slice(1)}`;
  }

  return {
    platform: 'dndbeyond', // Using dndbeyond as closest VTTPlatform
    gameId: `5etools-${pageType}`,
    gameName,
    currentUser: {
      id: '5etools-user',
      name: 'DM',
      isGM: true, // 5e.tools is typically used by DMs for reference
    },
    players: [{
      id: '5etools-user',
      name: 'DM',
      isGM: true,
    }],
  };
}

/**
 * Parse dice notation from text
 */
function parseDiceNotation(text: string): { notation: string; modifier: number } | null {
  // Match patterns like: 2d6+4, 1d20+5, 4d8, 2d6 + 3, etc.
  const match = text.match(/(\d+)d(\d+)\s*([+-]\s*\d+)?/i);
  if (!match) return null;

  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3].replace(/\s/g, ''), 10) : 0;

  return {
    notation: `${count}d${sides}${modifier >= 0 ? '+' : ''}${modifier}`,
    modifier,
  };
}

/**
 * Determine roll type from context
 */
function classifyRollType(element: Element, notation: string): VTTRoll['rollType'] {
  const text = element.textContent?.toLowerCase() || '';
  const parentText = element.parentElement?.textContent?.toLowerCase() || '';
  const combinedText = text + ' ' + parentText;

  // Check notation first
  if (notation.includes('d20')) {
    if (combinedText.includes('attack') || combinedText.includes('hit')) return 'attack';
    if (combinedText.includes('save') || combinedText.includes('saving throw')) return 'save';
    if (combinedText.includes('check') || combinedText.includes('ability')) return 'ability';
    if (combinedText.includes('initiative')) return 'initiative';
    return 'attack'; // Default for d20 in stat blocks is usually attack
  }

  // Non-d20 is usually damage
  if (combinedText.includes('damage')) return 'damage';
  if (combinedText.includes('heal')) return 'custom';

  return 'damage'; // Default for non-d20 is damage
}

/**
 * Get roll label from context
 */
function getRollLabel(element: Element): string | undefined {
  // Look for nearby label text
  const row = element.closest('tr, .entry, .property, p');
  if (row) {
    // Try to find attack name or property name
    const labelEl = row.querySelector('.attack-name, .property-name, .entry-title, strong, b, em');
    if (labelEl && labelEl !== element) {
      return labelEl.textContent?.trim();
    }
  }

  // Check for title attribute
  const title = element.getAttribute('title');
  if (title) return title;

  return undefined;
}

/**
 * Parse a roll from 5e.tools dice element
 * 5e.tools typically has clickable dice notation
 */
function parseRollFromElement(element: Element, clickedText?: string): VTTRoll | null {
  try {
    // Get the dice notation
    const notation =
      element.getAttribute('data-roll') ||
      element.getAttribute('data-dice') ||
      clickedText ||
      element.textContent?.trim() || '';

    const parsed = parseDiceNotation(notation);
    if (!parsed) return null;

    // Determine if this is a d20 roll
    const isD20 = notation.toLowerCase().includes('d20');
    const rollType = classifyRollType(element, notation);
    const label = getRollLabel(element);
    const context = extractViewContext();

    // Get results if available (5e.tools may show roll results)
    let results: number[] = [];
    let total = 0;

    // Check for roll result display
    const resultEl = element.querySelector('.roll-result, .dice-result, [data-result]');
    if (resultEl) {
      total = parseInt(resultEl.textContent || '0', 10);
    } else {
      // If no result shown, we'll simulate the roll
      // This is mainly for detecting when user clicks a dice notation
      const diceMatch = notation.match(/(\d+)d(\d+)/i);
      if (diceMatch) {
        const count = parseInt(diceMatch[1], 10);
        const sides = parseInt(diceMatch[2], 10);
        for (let i = 0; i < count; i++) {
          results.push(Math.floor(Math.random() * sides) + 1);
        }
        total = results.reduce((a, b) => a + b, 0) + parsed.modifier;
      }
    }

    // Analyze d20 rolls
    let critical = false;
    let fumble = false;
    if (isD20 && results.length > 0) {
      const analysis = analyzeD20Roll(results[0], 'dnd5e');
      critical = analysis.critical;
      fumble = analysis.fumble;
    }

    return {
      id: generateRollId('dndbeyond'),
      platform: 'dndbeyond',
      gameSystem: 'dnd5e',
      timestamp: new Date(),
      roller: {
        id: '5etools-user',
        name: context?.name || 'DM',
      },
      expression: parsed.notation,
      results,
      total,
      label,
      characterName: context?.type === 'bestiary' ? context.name : undefined,
      rollType,
      critical,
      fumble,
      raw: {
        html: element.outerHTML,
        source: '5etools',
        page: detectPageType(),
        context,
      },
    };
  } catch (error) {
    console.error('[FumbleBot] Failed to parse 5e.tools roll:', error);
    return null;
  }
}

/**
 * Parse packed dice data from 5etools element
 * data-packed-dice contains JSON: {"toRoll":"1d20+5","name":"Attack"}
 */
function parsePackedDice(element: Element): { notation: string; name?: string } | null {
  const packedData = element.getAttribute('data-packed-dice');
  if (!packedData) return null;

  try {
    const data = JSON.parse(packedData);
    return {
      notation: data.toRoll || data.roll || '',
      name: data.name || data.rollName,
    };
  } catch {
    return null;
  }
}

/**
 * Handle clicks on dice notation
 */
function handleDiceClick(event: Event) {
  const target = event.target as Element;

  // Check for 5etools packed dice (primary method)
  const packedDiceEl = target.closest(SELECTORS.packedDice);
  if (packedDiceEl) {
    const packed = parsePackedDice(packedDiceEl);
    if (packed?.notation) {
      const roll = parseRollFromElement(packedDiceEl, packed.notation);
      if (roll) {
        if (packed.name) roll.label = packed.name;
        console.log('[FumbleBot] Detected 5e.tools dice click (packed):', roll);
        sendEvent({ type: 'roll', data: roll });
        return;
      }
    }
  }

  // Fallback: check other dice element patterns
  const diceElement = target.closest(
    '.roller, [data-roll], .roll, .inline-roll, .render-roller, ' +
    SELECTORS.dcValue
  );

  if (diceElement) {
    const roll = parseRollFromElement(diceElement, target.textContent || undefined);
    if (roll) {
      console.log('[FumbleBot] Detected 5e.tools dice click:', roll);
      sendEvent({ type: 'roll', data: roll });
    }
  }
}

/**
 * Start observing for dynamic roll results
 */
function startRollObserver() {
  // Find the rollbox container if it exists, otherwise observe body
  const rollbox = document.querySelector(SELECTORS.rollbox);
  const contentArea =
    rollbox ||
    document.querySelector('#pagecontent, .page-content, #content, main') ||
    document.body;

  if (rollObserver) {
    rollObserver.disconnect();
  }

  rollObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          // Check for 5etools roll output items (primary result format)
          if (node.matches(SELECTORS.outRollItem) || node.querySelector(SELECTORS.outRollItem)) {
            const rollItem = node.matches(SELECTORS.outRollItem) ? node : node.querySelector(SELECTORS.outRollItem);
            if (rollItem) {
              // Try to extract roll info from the result
              const rollText = rollItem.textContent || '';
              const diceMatch = rollText.match(/(?:Rolling\s+)?(\d+d\d+[^=]*)\s*=\s*(\d+)/i);

              if (diceMatch) {
                const notation = diceMatch[1].trim();
                const total = parseInt(diceMatch[2], 10);
                const context = extractViewContext();

                const roll: VTTRoll = {
                  id: generateRollId('dndbeyond'),
                  platform: 'dndbeyond',
                  gameSystem: 'dnd5e',
                  timestamp: new Date(),
                  roller: { id: '5etools-user', name: context?.name || 'DM' },
                  expression: notation,
                  results: [],
                  total,
                  rollType: notation.includes('d20') ? 'attack' : 'damage',
                  raw: { text: rollText, source: '5etools-rollbox' },
                };

                // Check for crit/fumble indicators
                const hasCrit = rollItem.querySelector(SELECTORS.rollMax);
                const hasFumble = rollItem.querySelector(SELECTORS.rollMin);
                if (hasCrit) roll.critical = true;
                if (hasFumble) roll.fumble = true;

                console.log('[FumbleBot] Detected 5e.tools roll result:', roll);
                sendEvent({ type: 'roll', data: roll });
              }
            }
          }

          // Also check for out-roll container being added (batch of rolls)
          if (node.matches(SELECTORS.outRoll)) {
            const items = node.querySelectorAll(SELECTORS.outRollItem);
            items.forEach((item) => {
              const rollText = item.textContent || '';
              const diceMatch = rollText.match(/(\d+d\d+[^=]*)\s*=\s*(\d+)/i);
              if (diceMatch) {
                const notation = diceMatch[1].trim();
                const total = parseInt(diceMatch[2], 10);

                const roll: VTTRoll = {
                  id: generateRollId('dndbeyond'),
                  platform: 'dndbeyond',
                  gameSystem: 'dnd5e',
                  timestamp: new Date(),
                  roller: { id: '5etools-user', name: 'DM' },
                  expression: notation,
                  results: [],
                  total,
                  rollType: notation.includes('d20') ? 'attack' : 'damage',
                  raw: { text: rollText, source: '5etools-rollbox' },
                };

                console.log('[FumbleBot] Detected 5e.tools batch roll:', roll);
                sendEvent({ type: 'roll', data: roll });
              }
            });
          }
        }
      }
    }
  });

  rollObserver.observe(contentArea, { childList: true, subtree: true });
  console.log('[FumbleBot] Roll observer started for 5e.tools');

  // If rollbox exists separately, observe it too
  if (rollbox && contentArea !== rollbox) {
    const rollboxObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element && node.matches(SELECTORS.outRollItem)) {
            // Process roll result - same logic as above
            const rollText = node.textContent || '';
            const diceMatch = rollText.match(/(\d+d\d+[^=]*)\s*=\s*(\d+)/i);
            if (diceMatch) {
              const roll: VTTRoll = {
                id: generateRollId('dndbeyond'),
                platform: 'dndbeyond',
                gameSystem: 'dnd5e',
                timestamp: new Date(),
                roller: { id: '5etools-user', name: 'DM' },
                expression: diceMatch[1].trim(),
                results: [],
                total: parseInt(diceMatch[2], 10),
                rollType: 'custom',
                raw: { text: rollText, source: '5etools-rollbox' },
              };
              sendEvent({ type: 'roll', data: roll });
            }
          }
        }
      }
    });
    rollboxObserver.observe(rollbox, { childList: true, subtree: true });
  }
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
  sendEvent({ type: 'connected', data: sessionInfo });
  console.log('[FumbleBot] Connected to 5e.tools:', sessionInfo.gameName);

  // Start observing for rolls
  startRollObserver();

  // Listen for dice clicks
  document.addEventListener('click', handleDiceClick, true);

  // Update session info when navigation occurs (5e.tools is likely SPA)
  const observer = new MutationObserver(() => {
    const newInfo = extractSessionInfo();
    if (newInfo.gameName !== sessionInfo?.gameName) {
      sessionInfo = newInfo;
      sendEvent({ type: 'connected', data: sessionInfo });
      console.log('[FumbleBot] Session updated:', sessionInfo.gameName);
    }
  });

  // Observe URL changes through title/content changes
  const titleEl = document.querySelector('title, h1, .stats-name');
  if (titleEl) {
    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
  }

  // Also listen for popstate (back/forward navigation)
  window.addEventListener('popstate', () => {
    setTimeout(() => {
      const newInfo = extractSessionInfo();
      if (newInfo.gameName !== sessionInfo?.gameName) {
        sessionInfo = newInfo;
        sendEvent({ type: 'connected', data: sessionInfo });
      }
    }, 100);
  });
}

init();
