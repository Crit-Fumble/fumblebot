/**
 * Discord Activity View
 * HTML template for the Discord Activity iframe
 */

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
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background: #2b2d31;
      color: #ffffff;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      max-width: 600px;
      padding: 40px 20px;
    }
    h1 {
      font-size: 48px;
      margin: 0 0 20px 0;
    }
    .status {
      padding: 20px;
      background: #383a40;
      border-radius: 8px;
      margin: 20px 0;
      font-size: 16px;
    }
    .status.loading { color: #b5bac1; }
    .status.success { background: #248046; }
    .status.error { background: #da373c; }
    .status.coming-soon { background: #5865f2; }
    .user-info {
      margin-top: 30px;
      padding: 20px;
      background: #383a40;
      border-radius: 8px;
      text-align: left;
    }
    .user-info p {
      margin: 8px 0;
      font-size: 14px;
    }
    .user-info strong {
      color: #b5bac1;
    }
    .admin-content {
      margin-top: 30px;
    }
    .admin-content h2 {
      font-size: 24px;
      margin-bottom: 10px;
    }
    .admin-content p {
      color: #b5bac1;
      font-size: 14px;
    }
    .coming-soon-box {
      display: none;
      margin-top: 30px;
      padding: 40px;
      background: linear-gradient(135deg, #5865f2 0%, #eb459e 100%);
      border-radius: 12px;
    }
    .coming-soon-box h2 {
      font-size: 32px;
      margin: 0 0 10px 0;
    }
    .coming-soon-box p {
      font-size: 18px;
      margin: 0;
      opacity: 0.9;
    }
    .debug-info {
      margin-top: 20px;
      padding: 15px;
      background: #1e1f22;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      text-align: left;
      max-height: 200px;
      overflow-y: auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>FumbleBot</h1>
    <div id="status" class="status loading">Initializing Discord Activity...</div>
    <div id="user-info" class="user-info" style="display:none;"></div>
    <div id="admin-content" class="admin-content" style="display:none;">
      <h2>Hello World!</h2>
      <p>Discord Activity is working. You have administrator access.</p>
    </div>
    <div id="coming-soon" class="coming-soon-box">
      <h2>Coming March 2026</h2>
      <p>FumbleBot Activities are currently in development.</p>
    </div>
    <div id="debug" class="debug-info" style="display:none;"></div>
  </div>

  <script type="module">
    import { DiscordSDK } from 'https://esm.sh/@discord/embedded-app-sdk@2.4.0';

    const CLIENT_ID = '${clientId}';
    const ADMINISTRATOR = 0x8n; // Administrator permission bit

    const statusEl = document.getElementById('status');
    const userInfoEl = document.getElementById('user-info');
    const adminContentEl = document.getElementById('admin-content');
    const comingSoonEl = document.getElementById('coming-soon');
    const debugEl = document.getElementById('debug');

    // Enable debug mode with ?debug=1
    const urlParams = new URLSearchParams(window.location.search);
    const debugMode = urlParams.get('debug') === '1';
    if (debugMode) debugEl.style.display = 'block';

    function log(msg) {
      console.log('[FumbleBot]', msg);
      if (debugMode) {
        debugEl.innerHTML += msg + '<br>';
        debugEl.scrollTop = debugEl.scrollHeight;
      }
    }

    function setStatus(message, type = 'loading') {
      statusEl.textContent = message;
      statusEl.className = 'status ' + type;
    }

    async function main() {
      try {
        // Step 1: Initialize the SDK
        log('Initializing Discord SDK...');
        setStatus('Connecting to Discord...');
        const discordSdk = new DiscordSDK(CLIENT_ID);

        // Step 2: Wait for SDK to be ready
        log('Waiting for SDK ready...');
        await discordSdk.ready();
        log('SDK ready! Instance ID: ' + discordSdk.instanceId);

        // Step 3: Authorize with Discord
        log('Requesting authorization...');
        setStatus('Authorizing...');
        const { code } = await discordSdk.commands.authorize({
          client_id: CLIENT_ID,
          response_type: 'code',
          state: '',
          prompt: 'none',
          scope: ['identify', 'guilds.members.read'],
        });
        log('Got authorization code');

        // Step 4: Exchange code for access token
        log('Exchanging token...');
        setStatus('Authenticating...');
        const tokenResponse = await fetch('/.proxy/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        if (!tokenResponse.ok) {
          const err = await tokenResponse.text();
          throw new Error('Token exchange failed: ' + err);
        }

        const { access_token } = await tokenResponse.json();
        log('Got access token');

        // Step 5: Authenticate with the SDK
        log('Authenticating with SDK...');
        const auth = await discordSdk.commands.authenticate({ access_token });
        log('Authenticated as: ' + auth.user.username);

        // Step 6: Check permissions
        log('Checking permissions...');
        setStatus('Checking permissions...');
        const { permissions } = await discordSdk.commands.getChannelPermissions();
        const permBigInt = BigInt(permissions);
        log('Permissions: ' + permissions);

        // Check for ADMINISTRATOR permission
        const isAdmin = (permBigInt & ADMINISTRATOR) === ADMINISTRATOR;
        log('Is admin: ' + isAdmin);

        if (!isAdmin) {
          // Show coming soon message for non-admins
          setStatus('FumbleBot Activities', 'coming-soon');
          comingSoonEl.style.display = 'block';
          return;
        }

        // Step 7: Success! Show admin content
        setStatus('Welcome, Administrator!', 'success');
        userInfoEl.style.display = 'block';
        userInfoEl.innerHTML =
          '<p><strong>User:</strong> ' + auth.user.username + '</p>' +
          '<p><strong>User ID:</strong> ' + auth.user.id + '</p>' +
          '<p><strong>Guild ID:</strong> ' + (discordSdk.guildId || 'N/A') + '</p>' +
          '<p><strong>Channel ID:</strong> ' + (discordSdk.channelId || 'N/A') + '</p>' +
          '<p><strong>Instance ID:</strong> ' + discordSdk.instanceId + '</p>';
        adminContentEl.style.display = 'block';

      } catch (error) {
        console.error('Activity initialization failed:', error);
        log('ERROR: ' + error.message);
        setStatus('Error: ' + error.message, 'error');
      }
    }

    main();
  </script>
</body>
</html>
  `;
}
