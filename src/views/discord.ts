/**
 * Discord Activity View
 * HTML template for the Discord Activity iframe
 */

import {
  getAllStyles,
  getWaitingView,
  getAdminDashboard,
  getCreateCampaignModal,
  getDebugPanel,
  getAllScripts,
  getCampaignDetailView,
  getAddCharacterModal,
  getPlayerView,
  getServerSettingsPanel,
} from './partials/index.js';

/**
 * Generate Discord Activity HTML page
 * Full SDK integration with OAuth2 and permission checking
 */
export function getDiscordActivityHtml(clientId: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FumbleBot Activity</title>
  <style>
    ${getAllStyles()}
  </style>
</head>
<body>
  <div class="container">
    <h1>FumbleBot</h1>
    <div id="status" class="status loading">Initializing Discord Activity...</div>

    ${getWaitingView()}
    ${getAdminDashboard()}
    ${getCampaignDetailView()}
    ${getPlayerView()}
    ${getServerSettingsPanel()}
    ${getCreateCampaignModal()}
    ${getAddCharacterModal()}
    ${getDebugPanel()}
  </div>

  <script type="module">
    import { DiscordSDK } from 'https://esm.sh/@discord/embedded-app-sdk@2.4.0';

    ${getAllScripts(clientId)}
  </script>
</body>
</html>
  `;
}
