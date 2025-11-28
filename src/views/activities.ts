/**
 * Activity Views
 * HTML templates for specific activities (dice roller, character sheet, etc.)
 */

/**
 * Generate Character Sheet HTML
 */
export function getCharacterSheetHtml(characterId: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Character Sheet</title>
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #2b2d31; color: #fff; }
    .header { text-align: center; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📜 Character Sheet</h1>
    <p>Character ID: ${characterId}</p>
    <p><em>Character sheet viewer coming soon...</em></p>
  </div>
</body>
</html>
  `;
}

/**
 * Generate Dice Roller HTML
 */
export function getDiceRollerHtml(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dice Roller</title>
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #2b2d31; color: #fff; }
    .dice-container { max-width: 600px; margin: 0 auto; text-align: center; }
    h1 { margin-bottom: 30px; }
    .dice-buttons { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
    button { padding: 15px; font-size: 18px; background: #5865f2; color: white; border: none; border-radius: 5px; cursor: pointer; }
    button:hover { background: #4752c4; }
    .result { font-size: 48px; margin: 30px 0; min-height: 60px; }
    .history { text-align: left; max-height: 200px; overflow-y: auto; }
    .history-item { padding: 5px; border-bottom: 1px solid #383a40; }
  </style>
</head>
<body>
  <div class="dice-container">
    <h1>🎲 Dice Roller</h1>
    <div class="dice-buttons">
      <button onclick="roll(4)">d4</button>
      <button onclick="roll(6)">d6</button>
      <button onclick="roll(8)">d8</button>
      <button onclick="roll(10)">d10</button>
      <button onclick="roll(12)">d12</button>
      <button onclick="roll(20)">d20</button>
      <button onclick="roll(100)">d100</button>
    </div>
    <div class="result" id="result">Roll a die!</div>
    <div class="history" id="history"></div>
  </div>

  <script>
    function roll(sides) {
      const result = Math.floor(Math.random() * sides) + 1;
      document.getElementById('result').textContent = result;

      const history = document.getElementById('history');
      const item = document.createElement('div');
      item.className = 'history-item';
      item.textContent = 'd' + sides + ': ' + result;
      history.insertBefore(item, history.firstChild);

      // TODO: Send to Discord Activity SDK
      // window.parent.postMessage({ type: 'DICE_ROLL', sides, result }, 'https://discord.com');
    }
  </script>
</body>
</html>
  `;
}

/**
 * Generate Map Viewer HTML
 */
export function getMapViewerHtml(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Map Viewer</title>
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #2b2d31; color: #fff; }
  </style>
</head>
<body>
  <h1>🗺️ Map Viewer</h1>
  <p><em>Interactive map viewer coming soon...</em></p>
</body>
</html>
  `;
}

/**
 * Generate Initiative Tracker HTML
 */
export function getInitiativeTrackerHtml(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Initiative Tracker</title>
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #2b2d31; color: #fff; }
  </style>
</head>
<body>
  <h1>⚔️ Initiative Tracker</h1>
  <p><em>Combat initiative tracker coming soon...</em></p>
</body>
</html>
  `;
}

/**
 * Generate Spell Lookup HTML
 */
export function getSpellLookupHtml(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Spell Lookup</title>
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #2b2d31; color: #fff; }
  </style>
</head>
<body>
  <h1>✨ Spell Lookup</h1>
  <p><em>Spell reference tool coming soon...</em></p>
</body>
</html>
  `;
}
