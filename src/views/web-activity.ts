/**
 * Web Activity View
 * HTML template for the web-based admin panel (browser access)
 *
 * This wraps the same UI as the Discord Activity but uses:
 * - OAuth2 redirect flow instead of Discord SDK
 * - localStorage for session state instead of SDK context
 * - Direct API calls to /api/* instead of /.proxy/api/*
 */

import {
  getAllStyles,
  getWaitingView,
  getAdminDashboard,
  getCreateCampaignModal,
  getDebugPanel,
  getCampaignDetailView,
  getAddCharacterModal,
  getPlayerView,
  getServerSettingsPanel,
} from './partials/index.js';

/**
 * Generate Web Activity HTML page
 * Full admin UI accessible from browser with Discord OAuth
 */
export function getWebActivityHtml(clientId: string, publicUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FumbleBot Admin</title>
  <style>
    ${getAllStyles()}
    ${getWebActivityStyles()}
  </style>
</head>
<body>
  <nav class="web-nav">
    <div class="nav-brand">
      <span class="brand-icon">🎲</span>
      <span>FumbleBot Admin</span>
    </div>
    <div class="nav-user" id="nav-user">
      <button id="login-btn" class="btn btn-primary">Login with Discord</button>
    </div>
  </nav>

  <div class="container">
    <div id="status" class="status loading">Checking authentication...</div>

    <div id="login-prompt" class="login-prompt" style="display: none;">
      <div class="login-card">
        <h2>Welcome to FumbleBot</h2>
        <p>Sign in with your Discord account to manage campaigns, characters, and settings.</p>
        <button id="login-card-btn" class="btn btn-primary btn-lg">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;">
            <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 00-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 00-4.8 0c-.14-.34-.35-.76-.54-1.09-.01-.02-.04-.03-.07-.03-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.04.03.04.09-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.04.09.32.61.68 1.19 1.07 1.74.03.02.06.03.09.02 1.72-.53 3.45-1.33 5.25-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z"/>
          </svg>
          Login with Discord
        </button>
        <p class="login-note">You'll be redirected to Discord to authorize FumbleBot.</p>
      </div>
    </div>

    ${getWaitingView()}
    ${getAdminDashboard()}
    ${getCampaignDetailView()}
    ${getPlayerView()}
    ${getServerSettingsPanel()}
    ${getCreateCampaignModal()}
    ${getAddCharacterModal()}
    ${getDebugPanel()}

    <!-- Activity Panel -->
    <div id="activity-panel" class="activity-panel" style="display: none;">
      <div class="activity-header">
        <h2>Activity Hub</h2>
        <button class="btn btn-secondary" onclick="hideActivityPanel()">Back to Dashboard</button>
      </div>

      <!-- Command Bar -->
      <div class="command-bar">
        <input type="text" id="command-input" placeholder="/roll 2d6+3 or type a command..." autocomplete="off" />
        <button class="btn btn-primary" onclick="executeCommand()">Send</button>
      </div>

      <!-- Quick Dice Buttons -->
      <div class="quick-dice">
        <button class="dice-btn" onclick="quickRoll('1d4')">d4</button>
        <button class="dice-btn" onclick="quickRoll('1d6')">d6</button>
        <button class="dice-btn" onclick="quickRoll('1d8')">d8</button>
        <button class="dice-btn" onclick="quickRoll('1d10')">d10</button>
        <button class="dice-btn" onclick="quickRoll('1d12')">d12</button>
        <button class="dice-btn d20" onclick="quickRoll('1d20')">d20</button>
        <button class="dice-btn" onclick="quickRoll('1d100')">d100</button>
        <button class="dice-btn" onclick="quickRoll('2d6')">2d6</button>
      </div>

      <!-- Activity Tabs -->
      <div class="activity-tabs">
        <button class="activity-tab active" data-tab="dice" onclick="showActivityTab('dice')">Dice</button>
        <button class="activity-tab" data-tab="characters" onclick="showActivityTab('characters')">Characters</button>
        <button class="activity-tab" data-tab="initiative" onclick="showActivityTab('initiative')">Initiative</button>
      </div>

      <!-- Dice Activity -->
      <div id="activity-dice" class="activity-content active">
        <div id="dice-result" class="dice-result">
          <p class="placeholder">Roll some dice to see results here!</p>
        </div>
        <div id="roll-history" class="roll-history">
          <h3>Roll History</h3>
          <div id="history-list"></div>
        </div>
      </div>

      <!-- Characters Activity -->
      <div id="activity-characters" class="activity-content" style="display: none;">
        <p class="placeholder">Character management coming soon...</p>
      </div>

      <!-- Initiative Activity -->
      <div id="activity-initiative" class="activity-content" style="display: none;">
        <p class="placeholder">Initiative tracker coming soon...</p>
      </div>
    </div>
  </div>

  <script>
    ${getWebActivityScript(clientId, publicUrl)}
  </script>
</body>
</html>
  `;
}

/**
 * Additional styles for web activity (nav bar, login prompt)
 */
function getWebActivityStyles(): string {
  return `
    /* Web Navigation Bar */
    .web-nav {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 56px;
      background: #1e1f22;
      border-bottom: 1px solid #383a40;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 20px;
      z-index: 1000;
    }
    .nav-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 18px;
      font-weight: 600;
    }
    .brand-icon {
      font-size: 24px;
    }
    .nav-user {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .nav-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
    }
    .nav-username {
      font-size: 14px;
    }

    /* Adjust container for nav */
    body {
      padding-top: 56px;
    }
    .container {
      padding-top: 20px;
    }

    /* Login Prompt */
    .login-prompt {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: calc(100vh - 136px);
    }
    .login-card {
      background: #383a40;
      border-radius: 12px;
      padding: 40px;
      text-align: center;
      max-width: 400px;
    }
    .login-card h2 {
      margin: 0 0 16px 0;
      font-size: 24px;
    }
    .login-card p {
      color: #b5bac1;
      margin: 0 0 24px 0;
    }
    .btn-lg {
      padding: 14px 28px;
      font-size: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .login-note {
      font-size: 12px;
      color: #80848e;
      margin-top: 16px !important;
    }

    /* Activity Panel */
    .activity-panel {
      background: #2b2d31;
      border-radius: 8px;
      padding: 20px;
    }
    .activity-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .activity-header h2 {
      margin: 0;
    }

    /* Command Bar */
    .command-bar {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    .command-bar input {
      flex: 1;
      padding: 12px 16px;
      background: #1e1f22;
      border: 1px solid #383a40;
      border-radius: 6px;
      color: #ffffff;
      font-size: 14px;
      font-family: monospace;
    }
    .command-bar input:focus {
      outline: none;
      border-color: #5865f2;
    }
    .command-bar input::placeholder {
      color: #80848e;
    }

    /* Quick Dice */
    .quick-dice {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 20px;
    }
    .dice-btn {
      padding: 10px 16px;
      background: #383a40;
      border: none;
      border-radius: 6px;
      color: #ffffff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .dice-btn:hover {
      background: #5865f2;
    }
    .dice-btn.d20 {
      background: #5865f2;
    }
    .dice-btn.d20:hover {
      background: #4752c4;
    }

    /* Activity Tabs */
    .activity-tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 16px;
      border-bottom: 1px solid #383a40;
      padding-bottom: 8px;
    }
    .activity-tab {
      padding: 8px 16px;
      background: transparent;
      border: none;
      border-radius: 4px;
      color: #b5bac1;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .activity-tab:hover {
      background: #383a40;
      color: #ffffff;
    }
    .activity-tab.active {
      background: #5865f2;
      color: #ffffff;
    }

    /* Activity Content */
    .activity-content {
      display: none;
    }
    .activity-content.active {
      display: block;
    }
    .activity-content .placeholder {
      color: #80848e;
      text-align: center;
      padding: 40px;
    }

    /* Dice Result */
    .dice-result {
      background: #1e1f22;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .dice-result .embed {
      border-left: 4px solid #7c3aed;
      padding-left: 16px;
    }
    .dice-result .embed.crit {
      border-color: #22c55e;
    }
    .dice-result .embed.fumble {
      border-color: #ef4444;
    }
    .dice-result .embed-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .dice-result .embed-description {
      color: #b5bac1;
      margin-bottom: 12px;
    }
    .dice-result .embed-fields {
      display: flex;
      gap: 20px;
    }
    .dice-result .embed-field {
      flex: 1;
    }
    .dice-result .embed-field-name {
      font-size: 12px;
      color: #80848e;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .dice-result .embed-field-value {
      font-size: 16px;
      font-weight: 500;
    }

    /* Roll History */
    .roll-history {
      background: #1e1f22;
      border-radius: 8px;
      padding: 16px;
    }
    .roll-history h3 {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: #b5bac1;
    }
    .history-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #383a40;
    }
    .history-item:last-child {
      border-bottom: none;
    }
    .history-notation {
      font-family: monospace;
      color: #5865f2;
    }
    .history-result {
      font-weight: 600;
    }
    .history-result.crit {
      color: #22c55e;
    }
    .history-result.fumble {
      color: #ef4444;
    }

    /* Guild Selector */
    .guild-selector {
      margin-bottom: 20px;
    }
    .guild-selector label {
      display: block;
      font-size: 12px;
      color: #b5bac1;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    .guild-selector select {
      width: 100%;
      max-width: 300px;
      padding: 10px 12px;
      background: #1e1f22;
      border: none;
      border-radius: 4px;
      color: #ffffff;
      font-size: 14px;
    }
  `;
}

/**
 * JavaScript for web activity - handles auth, guild selection, and API calls
 * Uses server-side sessions for authentication
 */
function getWebActivityScript(clientId: string, publicUrl: string): string {
  return `
    const CLIENT_ID = '${clientId}';
    const PUBLIC_URL = '${publicUrl}';

    // DOM Elements
    const statusEl = document.getElementById('status');
    const loginPrompt = document.getElementById('login-prompt');
    const loginBtn = document.getElementById('login-btn');
    const loginCardBtn = document.getElementById('login-card-btn');
    const navUser = document.getElementById('nav-user');
    const waitingContainer = document.getElementById('waiting-container');
    const adminDashboard = document.getElementById('admin-dashboard');
    const usernameEl = document.getElementById('username');
    const campaignGrid = document.getElementById('campaign-grid');
    const createModal = document.getElementById('create-modal');
    const debugEl = document.getElementById('debug');

    // State
    let currentUser = null;
    let userGuilds = [];
    let selectedGuildId = null;
    let registeredSystems = [];
    let previewedSystem = null;

    // Web mode context (replaces Discord SDK context)
    let discordContext = {
      guildId: null,
      channelId: null,
      instanceId: 'web-' + Date.now()
    };

    // Expose for Discord Activity scripts compatibility
    window.discordSdkInstance = null; // Web mode doesn't use SDK

    // Debug mode
    const urlParams = new URLSearchParams(window.location.search);
    const debugMode = urlParams.get('debug') === '1';
    if (debugMode && debugEl) debugEl.style.display = 'block';

    function log(msg) {
      console.log('[FumbleBot Web]', msg);
      if (debugMode && debugEl) {
        debugEl.innerHTML += msg + '<br>';
        debugEl.scrollTop = debugEl.scrollHeight;
      }
    }

    function setStatus(message, type = 'loading') {
      statusEl.textContent = message;
      statusEl.className = 'status ' + type;
    }

    // OAuth login redirect - uses state parameter for return URL
    function startOAuthFlow() {
      const scope = 'identify guilds guilds.members.read';
      const state = encodeURIComponent('/web/activity');
      const redirectUri = encodeURIComponent(PUBLIC_URL + '/auth/callback');
      const authUrl = 'https://discord.com/api/oauth2/authorize' +
        '?client_id=' + CLIENT_ID +
        '&redirect_uri=' + redirectUri +
        '&response_type=code' +
        '&scope=' + encodeURIComponent(scope) +
        '&state=' + state;
      window.location.href = authUrl;
    }

    loginBtn?.addEventListener('click', startOAuthFlow);
    loginCardBtn?.addEventListener('click', startOAuthFlow);

    // Check server-side session auth
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include' // Important for cookies
        });
        if (response.ok) {
          const data = await response.json();
          return data.user;
        }
      } catch (error) {
        log('Auth check error: ' + error.message);
      }
      return null;
    }

    // Fetch user's guilds via our API (uses server-side stored token)
    async function fetchUserGuilds() {
      try {
        const response = await fetch('/api/auth/guilds', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          userGuilds = data.guilds || [];
          log('Loaded ' + userGuilds.length + ' guilds');
          return userGuilds;
        }
      } catch (error) {
        log('Error fetching guilds: ' + error.message);
      }
      return [];
    }

    // Show guild selector in admin dashboard
    function showGuildSelector() {
      // Find or create guild selector
      let selector = document.querySelector('.guild-selector');
      if (!selector) {
        selector = document.createElement('div');
        selector.className = 'guild-selector';
        selector.innerHTML = \`
          <label>Select Server</label>
          <select id="guild-select" onchange="handleGuildChange(this.value)">
            <option value="">-- Choose a server --</option>
          </select>
        \`;
        const dashboardHeader = document.querySelector('.dashboard-header');
        if (dashboardHeader) {
          dashboardHeader.after(selector);
        }
      }

      const select = document.getElementById('guild-select');
      select.innerHTML = '<option value="">-- Choose a server --</option>';

      // Filter to guilds where user is admin/owner
      const adminGuilds = userGuilds.filter(g => {
        const permissions = BigInt(g.permissions);
        const ADMINISTRATOR = 0x8n;
        return (permissions & ADMINISTRATOR) === ADMINISTRATOR || g.owner;
      });

      adminGuilds.forEach(guild => {
        const option = document.createElement('option');
        option.value = guild.id;
        option.textContent = guild.name;
        if (selectedGuildId === guild.id) option.selected = true;
        select.appendChild(option);
      });

      log('Showing ' + adminGuilds.length + ' admin guilds');
    }

    window.handleGuildChange = function(guildId) {
      selectedGuildId = guildId;
      discordContext.guildId = guildId;
      localStorage.setItem('fumblebot_selected_guild', guildId);
      log('Selected guild: ' + guildId);

      if (guildId) {
        loadCampaigns();
      }
    };

    // Update nav with user info
    function updateNavUser(user) {
      const avatarUrl = user.avatar
        ? 'https://cdn.discordapp.com/avatars/' + user.id + '/' + user.avatar + '.png?size=32'
        : 'https://cdn.discordapp.com/embed/avatars/0.png';

      navUser.innerHTML = \`
        <img class="nav-avatar" src="\${avatarUrl}" alt="">
        <span class="nav-username">\${user.username}</span>
        <button class="btn btn-secondary" onclick="logout()" style="padding: 6px 12px; font-size: 12px;">Logout</button>
      \`;
    }

    window.logout = async function() {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include'
        });
      } catch (e) {
        // Ignore errors
      }
      localStorage.removeItem('fumblebot_selected_guild');
      window.location.href = '/web/activity';
    };

    // Modal functions (from Discord Activity scripts)
    window.showCreateModal = function() {
      createModal.style.display = 'flex';
    };

    window.hideCreateModal = function(event) {
      if (!event || event.target === createModal) {
        createModal.style.display = 'none';
        document.getElementById('system-preview').style.display = 'none';
        document.getElementById('add-system-section').style.display = 'none';
        previewedSystem = null;
      }
    };

    // System management (adapted for web - direct /api calls)
    window.handleSystemChange = function() {
      const select = document.getElementById('campaign-system');
      const addSection = document.getElementById('add-system-section');
      const preview = document.getElementById('system-preview');

      if (select.value === '__add_new__') {
        addSection.style.display = 'block';
        preview.style.display = 'none';
        previewedSystem = null;
      } else {
        addSection.style.display = 'none';
        preview.style.display = 'none';
        previewedSystem = null;
      }
    };

    window.previewManifest = async function() {
      const urlInput = document.getElementById('manifest-url');
      const url = urlInput.value.trim();

      if (!url) {
        alert('Please enter a manifest URL');
        return;
      }

      try {
        log('Previewing manifest: ' + url);
        const response = await fetch('/api/systems/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manifestUrl: url }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to preview manifest');
        }

        const data = await response.json();
        log('Preview result: ' + data.title);

        previewedSystem = { ...data, manifestUrl: url };

        document.getElementById('preview-title').textContent = data.title;
        document.getElementById('preview-version').textContent = 'v' + (data.version || 'unknown');
        document.getElementById('preview-description').textContent = data.description || 'No description available';
        document.getElementById('system-preview').style.display = 'block';

      } catch (error) {
        log('Preview error: ' + error.message);
        alert('Error: ' + error.message);
      }
    };

    window.addPreviewedSystem = async function() {
      if (!previewedSystem) return;

      try {
        log('Adding system: ' + previewedSystem.title);
        const response = await fetch('/api/systems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manifestUrl: previewedSystem.manifestUrl }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to add system');
        }

        const newSystem = await response.json();
        log('System added: ' + newSystem.id);

        registeredSystems.push(newSystem);
        updateSystemDropdown();
        document.getElementById('campaign-system').value = newSystem.id;

        document.getElementById('add-system-section').style.display = 'none';
        document.getElementById('system-preview').style.display = 'none';
        document.getElementById('manifest-url').value = '';
        previewedSystem = null;

      } catch (error) {
        log('Add system error: ' + error.message);
        alert('Error: ' + error.message);
      }
    };

    async function loadSystems() {
      try {
        log('Loading registered systems...');
        const response = await fetch('/api/systems');

        if (response.ok) {
          const data = await response.json();
          registeredSystems = data.systems || [];
          log('Loaded ' + registeredSystems.length + ' systems');
          updateSystemDropdown();
        }
      } catch (error) {
        log('Error loading systems: ' + error.message);
      }
    }

    function updateSystemDropdown() {
      const select = document.getElementById('campaign-system');
      if (!select) return;

      select.innerHTML = '<option value="">-- Select a system --</option>';

      for (const system of registeredSystems) {
        const option = document.createElement('option');
        option.value = system.id;
        option.textContent = system.title + (system.version ? ' v' + system.version : '');
        select.appendChild(option);
      }

      const addOption = document.createElement('option');
      addOption.value = '__add_new__';
      addOption.textContent = '+ Add New System...';
      addOption.style.color = '#5865f2';
      select.appendChild(addOption);
    }

    // Campaign management
    window.handleCreateCampaign = async function(event) {
      event.preventDefault();
      const name = document.getElementById('campaign-name').value;
      const systemId = document.getElementById('campaign-system').value;
      const description = document.getElementById('campaign-description').value;

      const system = registeredSystems.find(s => s.id === systemId);
      const systemTitle = system ? system.title : systemId.toUpperCase();

      log('Creating campaign: ' + name + ' (' + systemTitle + ')');

      // TODO: API call to create campaign
      const card = document.createElement('div');
      card.className = 'campaign-card';
      card.innerHTML = \`
        <div class="card-title">\${name}</div>
        <div class="card-system">\${systemTitle}</div>
        <p class="card-description">\${description || 'No description'}</p>
        <div class="card-status">
          <div class="status-indicator">
            <div class="status-dot stopped"></div>
            <span>Stopped</span>
          </div>
          <button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px;">Launch</button>
        </div>
      \`;

      const createCard = document.querySelector('.campaign-card.create-new');
      campaignGrid.insertBefore(card, createCard);

      hideCreateModal();
      document.getElementById('create-form').reset();
    };

    async function loadCampaigns() {
      if (!selectedGuildId) {
        log('No guild selected, skipping campaign load');
        return;
      }

      log('Loading campaigns for guild: ' + selectedGuildId);

      // TODO: Fetch campaigns from API
      // GET /api/campaigns?guildId=xxx

      // For now, show an example campaign
      const existingCards = document.querySelectorAll('.campaign-card:not(.create-new)');
      existingCards.forEach(card => card.remove());

      const exampleCard = document.createElement('div');
      exampleCard.className = 'campaign-card';
      exampleCard.innerHTML = \`
        <div class="card-title">Example Campaign</div>
        <div class="card-system">D&D 5e</div>
        <p class="card-description">This is a placeholder campaign.</p>
        <div class="card-status">
          <div class="status-indicator">
            <div class="status-dot stopped"></div>
            <span>Stopped</span>
          </div>
          <button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px;">Launch</button>
        </div>
      \`;

      const createCard = document.querySelector('.campaign-card.create-new');
      campaignGrid.insertBefore(exampleCard, createCard);
    }

    // Settings functions (adapted for web - direct API calls)
    let guildChannels = [];
    let guildRoles = [];
    let channelLinks = { ic: '', ooc: '', dice: '', gm: '', announce: '', voice: '' };
    let roleMappings = {};

    const serverSettingsPanel = document.getElementById('server-settings-panel');

    window.showServerSettings = function() {
      adminDashboard.style.display = 'none';
      serverSettingsPanel.style.display = 'block';
      loadChannelsAndRoles();
    };

    window.backToAdminDashboard = function() {
      serverSettingsPanel.style.display = 'none';
      adminDashboard.style.display = 'block';
    };

    window.showSettingsTab = function(tabName) {
      document.querySelectorAll('.settings-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.settingsTab === tabName);
      });
      document.querySelectorAll('.settings-tab-content').forEach(content => {
        content.style.display = 'none';
      });
      document.getElementById('settings-' + tabName + '-tab').style.display = 'block';
    };

    async function loadChannelsAndRoles() {
      if (!selectedGuildId) {
        log('No guild selected');
        return;
      }

      log('Loading channels and roles for guild: ' + selectedGuildId);

      try {
        // Fetch roles from our API (uses bot token)
        const roleResponse = await fetch('/api/guilds/' + selectedGuildId + '/roles');
        if (roleResponse.ok) {
          const data = await roleResponse.json();
          guildRoles = data.roles || [];
          log('Loaded ' + guildRoles.length + ' roles from API');
        }

        // Load saved settings
        const settingsResponse = await fetch('/api/guilds/' + selectedGuildId + '/settings');
        if (settingsResponse.ok) {
          const data = await settingsResponse.json();
          channelLinks = data.channelLinks || channelLinks;
          roleMappings = data.roleMappings || {};
          log('Loaded saved settings');
        }

        populateChannelSelects();
        populateRoleSelects();
        renderRoleMappings();

      } catch (error) {
        log('Error loading channels/roles: ' + error.message);
      }
    }

    function populateChannelSelects() {
      // In web mode, we need to fetch channels from API
      // For now, show placeholder message
      ['ic', 'ooc', 'dice', 'gm', 'announce', 'voice'].forEach(linkType => {
        const select = document.getElementById('link-' + linkType + '-channel');
        if (select) {
          select.innerHTML = '<option value="">-- Channels load via Discord bot --</option>';
          updateChannelStatus(linkType);
        }
      });
    }

    function populateRoleSelects() {
      const roleSelect = document.getElementById('new-discord-role');
      if (!roleSelect) return;

      roleSelect.innerHTML = '<option value="">Select Discord Role...</option>';

      const filteredRoles = guildRoles
        .filter(r => r.name !== '@everyone' && !r.managed)
        .sort((a, b) => (b.position || 0) - (a.position || 0));

      filteredRoles.forEach(role => {
        const option = document.createElement('option');
        option.value = role.id;
        option.textContent = role.name;
        if (role.color) {
          option.style.color = '#' + role.color.toString(16).padStart(6, '0');
        }
        roleSelect.appendChild(option);
      });
    }

    function updateChannelStatus(linkType) {
      const statusEl = document.getElementById('link-' + linkType + '-status');
      if (!statusEl) return;

      if (channelLinks[linkType]) {
        statusEl.textContent = '✓ Linked';
        statusEl.className = 'channel-link-status linked';
      } else {
        statusEl.textContent = '○ Unlinked';
        statusEl.className = 'channel-link-status unlinked';
      }
    }

    window.updateChannelLink = function(linkType, channelId) {
      channelLinks[linkType] = channelId;
      updateChannelStatus(linkType);
      log('Updated ' + linkType + ' channel to: ' + (channelId || 'none'));
    };

    window.refreshChannelList = async function() {
      log('Refreshing channel list...');
      await loadChannelsAndRoles();
    };

    window.saveChannelLinks = async function() {
      if (!selectedGuildId) {
        alert('Please select a server first');
        return;
      }

      log('Saving channel links...');

      try {
        const response = await fetch('/api/guilds/' + selectedGuildId + '/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelLinks }),
        });

        if (!response.ok) throw new Error('Failed to save settings');

        log('Channel links saved!');
        alert('Channel links saved successfully!');

      } catch (error) {
        log('Error saving: ' + error.message);
        alert('Error saving settings: ' + error.message);
      }
    };

    const FOUNDRY_ROLE_NAMES = {
      '1': 'Player',
      '2': 'Trusted Player',
      '3': 'Assistant GM',
      '4': 'Game Master'
    };

    function renderRoleMappings() {
      const container = document.getElementById('role-mappings-container');
      if (!container) return;

      container.innerHTML = '';

      Object.entries(roleMappings).forEach(([discordRoleId, foundryRole]) => {
        const role = guildRoles.find(r => r.id === discordRoleId);
        if (!role) return;

        const roleColor = role.color ? '#' + role.color.toString(16).padStart(6, '0') : '#99aab5';

        const item = document.createElement('div');
        item.className = 'role-mapping-item';
        item.innerHTML = \`
          <div class="discord-role">
            <div class="role-color" style="background: \${roleColor}"></div>
            <span>\${role.name}</span>
          </div>
          <span class="mapping-arrow">→</span>
          <div class="foundry-role">\${FOUNDRY_ROLE_NAMES[foundryRole] || 'Unknown'}</div>
          <button class="remove-btn" onclick="removeRoleMapping('\${discordRoleId}')" title="Remove">×</button>
        \`;
        container.appendChild(item);
      });

      if (Object.keys(roleMappings).length === 0) {
        container.innerHTML = '<p style="color: #80848e; text-align: center; padding: 20px;">No role mappings configured</p>';
      }
    }

    window.addRoleMapping = function() {
      const discordRoleId = document.getElementById('new-discord-role').value;
      const foundryRole = document.getElementById('new-foundry-role').value;

      if (!discordRoleId || !foundryRole) {
        alert('Please select both a Discord role and a Foundry permission level');
        return;
      }

      roleMappings[discordRoleId] = foundryRole;
      renderRoleMappings();

      document.getElementById('new-discord-role').value = '';
      document.getElementById('new-foundry-role').value = '';

      log('Added role mapping: ' + discordRoleId + ' -> ' + FOUNDRY_ROLE_NAMES[foundryRole]);
    };

    window.removeRoleMapping = function(discordRoleId) {
      delete roleMappings[discordRoleId];
      renderRoleMappings();
      log('Removed role mapping: ' + discordRoleId);
    };

    // ===========================================
    // Activity Panel & Commands
    // ===========================================

    const activityPanel = document.getElementById('activity-panel');
    const diceResultEl = document.getElementById('dice-result');
    const historyListEl = document.getElementById('history-list');
    const commandInput = document.getElementById('command-input');
    let rollHistory = [];

    window.showActivityPanel = function() {
      adminDashboard.style.display = 'none';
      serverSettingsPanel.style.display = 'none';
      activityPanel.style.display = 'block';
      log('Showing activity panel');
    };

    window.hideActivityPanel = function() {
      activityPanel.style.display = 'none';
      adminDashboard.style.display = 'block';
    };

    window.showActivityTab = function(tabName) {
      document.querySelectorAll('.activity-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
      });
      document.querySelectorAll('.activity-content').forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
      });
      const tabContent = document.getElementById('activity-' + tabName);
      if (tabContent) {
        tabContent.style.display = 'block';
        tabContent.classList.add('active');
      }
    };

    window.executeCommand = async function() {
      const input = commandInput.value.trim();
      if (!input) return;

      log('Executing command: ' + input);
      commandInput.value = '';

      try {
        const response = await fetch('/api/commands', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            input: input.startsWith('/') ? input : '/roll ' + input,
            guildId: selectedGuildId,
          }),
        });

        const result = await response.json();
        log('Command result: ' + JSON.stringify(result));

        if (result.success && result.embed) {
          displayDiceResult(result.embed, result.data?.roll);
        } else if (result.message) {
          displayError(result.message);
        }
      } catch (error) {
        log('Command error: ' + error.message);
        displayError('Failed to execute command');
      }
    };

    window.quickRoll = async function(notation) {
      log('Quick roll: ' + notation);

      try {
        const response = await fetch('/api/commands/roll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            dice: notation,
            guildId: selectedGuildId,
          }),
        });

        const result = await response.json();

        if (result.success && result.embed) {
          displayDiceResult(result.embed, result.data?.roll);
        } else if (result.message) {
          displayError(result.message);
        }
      } catch (error) {
        log('Roll error: ' + error.message);
        displayError('Failed to roll dice');
      }
    };

    function displayDiceResult(embed, rollData) {
      const isCrit = embed.title?.includes('CRITICAL');
      const isFumble = embed.title?.includes('FUMBLE');
      const embedClass = isCrit ? 'crit' : isFumble ? 'fumble' : '';

      diceResultEl.innerHTML = \`
        <div class="embed \${embedClass}">
          <div class="embed-title">\${embed.title || 'Dice Roll'}</div>
          <div class="embed-description">\${embed.description || ''}</div>
          <div class="embed-fields">
            \${(embed.fields || []).map(field => \`
              <div class="embed-field">
                <div class="embed-field-name">\${field.name}</div>
                <div class="embed-field-value">\${field.value}</div>
              </div>
            \`).join('')}
          </div>
        </div>
      \`;

      // Add to history
      if (rollData) {
        rollHistory.unshift({
          notation: rollData.notation,
          total: rollData.total,
          isCrit: rollData.isCrit,
          isFumble: rollData.isFumble,
          timestamp: new Date(),
        });

        // Keep only last 20 rolls
        if (rollHistory.length > 20) rollHistory = rollHistory.slice(0, 20);

        updateHistoryDisplay();
      }
    }

    function updateHistoryDisplay() {
      if (!historyListEl) return;

      if (rollHistory.length === 0) {
        historyListEl.innerHTML = '<p style="color: #80848e; text-align: center;">No rolls yet</p>';
        return;
      }

      historyListEl.innerHTML = rollHistory.map(roll => {
        const resultClass = roll.isCrit ? 'crit' : roll.isFumble ? 'fumble' : '';
        return \`
          <div class="history-item">
            <span class="history-notation">\${roll.notation}</span>
            <span class="history-result \${resultClass}">\${roll.total}</span>
          </div>
        \`;
      }).join('');
    }

    function displayError(message) {
      diceResultEl.innerHTML = \`
        <div class="embed fumble">
          <div class="embed-title">Error</div>
          <div class="embed-description">\${message}</div>
        </div>
      \`;
    }

    // Handle Enter key in command input
    if (commandInput) {
      commandInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          executeCommand();
        }
      });
    }

    // ===========================================
    // Bot Settings
    // ===========================================

    window.saveBotSettings = async function() {
      if (!selectedGuildId) {
        alert('Please select a server first');
        return;
      }

      const settings = {
        autoLogIC: document.getElementById('setting-autolog-ic')?.checked ?? true,
        defaultMode: document.getElementById('setting-default-mode')?.value ?? 'ic',
        diceNotify: document.getElementById('setting-dice-notify')?.checked ?? true,
        autoSession: document.getElementById('setting-auto-session')?.checked ?? false,
        reminderTime: parseInt(document.getElementById('setting-reminder-time')?.value ?? '60'),
      };

      log('Saving bot settings...');

      try {
        const response = await fetch('/api/guilds/' + selectedGuildId + '/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelLinks, roleMappings, botSettings: settings }),
        });

        if (!response.ok) throw new Error('Failed to save settings');

        log('Settings saved!');
        alert('Settings saved successfully!');

      } catch (error) {
        log('Error saving: ' + error.message);
        alert('Error saving settings: ' + error.message);
      }
    };

    window.resetBotSettings = function() {
      document.getElementById('setting-autolog-ic').checked = true;
      document.getElementById('setting-default-mode').value = 'ic';
      document.getElementById('setting-dice-notify').checked = true;
      document.getElementById('setting-auto-session').checked = false;
      document.getElementById('setting-reminder-time').value = '60';
      log('Bot settings reset to defaults');
    };

    // Main initialization
    async function main() {
      log('Initializing Web Activity...');

      // Check server-side session
      const user = await checkAuth();

      if (!user) {
        log('Not authenticated');
        setStatus('Please sign in to continue', 'waiting');
        statusEl.style.display = 'none';
        loginPrompt.style.display = 'flex';
        return;
      }

      currentUser = user;

      log('Authenticated as: ' + currentUser.username);
      setStatus('Loading...', 'loading');

      updateNavUser(currentUser);

      // Fetch user's guilds
      await fetchUserGuilds();

      // Check for previously selected guild
      selectedGuildId = localStorage.getItem('fumblebot_selected_guild');
      discordContext.guildId = selectedGuildId;

      // Show admin dashboard
      statusEl.style.display = 'none';
      usernameEl.textContent = currentUser.username;
      adminDashboard.style.display = 'block';

      // Show guild selector and load data
      showGuildSelector();
      await loadSystems();

      if (selectedGuildId) {
        await loadCampaigns();
      }

      log('Web Activity ready');
    }

    main();
  `;
}
