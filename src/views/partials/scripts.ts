/**
 * JavaScript code for Discord Activity views
 * Split into logical modules for maintainability
 */

/**
 * Core utilities and state management
 */
export function getCoreScript(): string {
  return `
    const CLIENT_ID = '__CLIENT_ID__';
    const ADMINISTRATOR = 0x8n; // Administrator permission bit

    // DOM Elements
    const statusEl = document.getElementById('status');
    const waitingContainer = document.getElementById('waiting-container');
    const adminDashboard = document.getElementById('admin-dashboard');
    const usernameEl = document.getElementById('username');
    const campaignGrid = document.getElementById('campaign-grid');
    const createModal = document.getElementById('create-modal');
    const debugEl = document.getElementById('debug');

    // State
    let currentUser = null;
    let discordContext = null;
    let registeredSystems = [];
    let previewedSystem = null;

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
  `;
}

/**
 * Modal management functions
 */
export function getModalScript(): string {
  return `
    window.showCreateModal = function() {
      createModal.style.display = 'flex';
    };

    window.hideCreateModal = function(event) {
      if (!event || event.target === createModal) {
        createModal.style.display = 'none';
        // Reset system preview when closing modal
        document.getElementById('system-preview').style.display = 'none';
        document.getElementById('add-system-section').style.display = 'none';
        previewedSystem = null;
      }
    };
  `;
}

/**
 * System management functions
 */
export function getSystemScript(): string {
  return `
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
        const response = await fetch('/.proxy/api/systems/preview', {
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

        // Store for later use
        previewedSystem = { ...data, manifestUrl: url };

        // Show preview
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
        const response = await fetch('/.proxy/api/systems', {
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

        // Add to local list and update dropdown
        registeredSystems.push(newSystem);
        updateSystemDropdown();

        // Select the new system
        document.getElementById('campaign-system').value = newSystem.id;

        // Hide add section and preview
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
        const response = await fetch('/.proxy/api/systems');

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
      select.innerHTML = '<option value="">-- Select a system --</option>';

      for (const system of registeredSystems) {
        const option = document.createElement('option');
        option.value = system.id;
        option.textContent = system.title + (system.version ? ' v' + system.version : '');
        select.appendChild(option);
      }

      // Add "Add New System" option at the end
      const addOption = document.createElement('option');
      addOption.value = '__add_new__';
      addOption.textContent = '+ Add New System...';
      addOption.style.color = '#5865f2';
      select.appendChild(addOption);
    }
  `;
}

/**
 * Campaign management functions
 */
export function getCampaignScript(): string {
  return `
    window.handleCreateCampaign = async function(event) {
      event.preventDefault();
      const name = document.getElementById('campaign-name').value;
      const systemId = document.getElementById('campaign-system').value;
      const description = document.getElementById('campaign-description').value;

      // Find system info
      const system = registeredSystems.find(s => s.id === systemId);
      const systemTitle = system ? system.title : systemId.toUpperCase();

      log('Creating campaign: ' + name + ' (' + systemTitle + ')');

      // TODO: API call to create campaign
      // For now, just add a placeholder card
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

      // Insert before the "Create New" card
      const createCard = document.querySelector('.campaign-card.create-new');
      campaignGrid.insertBefore(card, createCard);

      hideCreateModal();
      document.getElementById('create-form').reset();
    };

    async function loadCampaigns() {
      // TODO: Fetch campaigns from API
      // GET /.proxy/api/campaigns?guildId=xxx
      log('Loading campaigns... (stub)');

      // For now, show an example campaign
      const exampleCard = document.createElement('div');
      exampleCard.className = 'campaign-card';
      exampleCard.innerHTML = \`
        <div class="card-title">Example Campaign</div>
        <div class="card-system">D&D 5e</div>
        <p class="card-description">This is a placeholder campaign to show the UI.</p>
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
  `;
}

/**
 * Server settings and channel linking scripts
 */
export function getSettingsScript(): string {
  return `
    // Settings state
    let guildChannels = [];
    let guildRoles = [];
    let channelLinks = {
      ic: '',
      ooc: '',
      dice: '',
      gm: '',
      announce: '',
      voice: ''
    };
    let roleMappings = {}; // { discordRoleId: foundryRoleLevel }

    // DOM elements for settings
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
      // Update tab buttons
      document.querySelectorAll('.settings-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.settingsTab === tabName);
      });

      // Update tab content
      document.querySelectorAll('.settings-tab-content').forEach(content => {
        content.style.display = 'none';
      });
      document.getElementById('settings-' + tabName + '-tab').style.display = 'block';
    };

    async function loadChannelsAndRoles() {
      log('Loading channels and roles from Discord SDK...');

      try {
        // Get channels using Discord SDK
        // Note: This requires the guilds.channels.read scope
        const channelResult = await window.discordSdkInstance?.commands.getChannels?.();
        if (channelResult?.channels) {
          guildChannels = channelResult.channels;
          log('Loaded ' + guildChannels.length + ' channels');
        }

        // Get roles using Discord SDK (if available)
        // Note: The SDK may not expose roles directly - we may need to fetch via API
        if (window.discordSdkInstance?.commands.getRoles) {
          const roleResult = await window.discordSdkInstance.commands.getRoles();
          if (roleResult?.roles) {
            guildRoles = roleResult.roles;
            log('Loaded ' + guildRoles.length + ' roles');
          }
        } else {
          // Fallback: fetch roles from our API which can use bot token
          const roleResponse = await fetch('/.proxy/api/guilds/' + discordContext.guildId + '/roles');
          if (roleResponse.ok) {
            const data = await roleResponse.json();
            guildRoles = data.roles || [];
            log('Loaded ' + guildRoles.length + ' roles from API');
          }
        }

        // Load saved channel links from API
        if (discordContext?.guildId) {
          const response = await fetch('/.proxy/api/guilds/' + discordContext.guildId + '/settings');
          if (response.ok) {
            const data = await response.json();
            channelLinks = data.channelLinks || channelLinks;
            roleMappings = data.roleMappings || {};
            log('Loaded saved settings');
          }
        }

        populateChannelSelects();
        populateRoleSelects();
        renderRoleMappings();

      } catch (error) {
        log('Error loading channels/roles: ' + error.message);
        // Fallback: show empty dropdowns with message
        populateChannelSelects();
        populateRoleSelects();
      }
    }

    function populateChannelSelects() {
      const textChannels = guildChannels.filter(c => c.type === 0); // GUILD_TEXT
      const voiceChannels = guildChannels.filter(c => c.type === 2); // GUILD_VOICE

      // Text channel selects
      ['ic', 'ooc', 'dice', 'gm', 'announce'].forEach(linkType => {
        const select = document.getElementById('link-' + linkType + '-channel');
        if (!select) return;

        select.innerHTML = '<option value="">-- Not linked --</option>';
        textChannels.forEach(channel => {
          const option = document.createElement('option');
          option.value = channel.id;
          option.textContent = '#' + channel.name;
          if (channelLinks[linkType] === channel.id) {
            option.selected = true;
          }
          select.appendChild(option);
        });

        updateChannelStatus(linkType);
      });

      // Voice channel select
      const voiceSelect = document.getElementById('link-voice-channel');
      if (voiceSelect) {
        voiceSelect.innerHTML = '<option value="">-- Not linked --</option>';
        voiceChannels.forEach(channel => {
          const option = document.createElement('option');
          option.value = channel.id;
          option.textContent = '🔊 ' + channel.name;
          if (channelLinks.voice === channel.id) {
            option.selected = true;
          }
          voiceSelect.appendChild(option);
        });
        updateChannelStatus('voice');
      }
    }

    function populateRoleSelects() {
      const roleSelect = document.getElementById('new-discord-role');
      if (!roleSelect) return;

      roleSelect.innerHTML = '<option value="">Select Discord Role...</option>';

      // Filter out @everyone and bot roles, sort by position
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
      log('Saving channel links...');

      try {
        const response = await fetch('/.proxy/api/guilds/' + discordContext.guildId + '/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelLinks }),
        });

        if (!response.ok) {
          throw new Error('Failed to save settings');
        }

        log('Channel links saved!');
        alert('Channel links saved successfully!');

      } catch (error) {
        log('Error saving: ' + error.message);
        alert('Error saving settings: ' + error.message);
      }
    };

    // Role mapping functions
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

      // Reset selects
      document.getElementById('new-discord-role').value = '';
      document.getElementById('new-foundry-role').value = '';

      log('Added role mapping: ' + discordRoleId + ' -> ' + FOUNDRY_ROLE_NAMES[foundryRole]);
    };

    window.removeRoleMapping = function(discordRoleId) {
      delete roleMappings[discordRoleId];
      renderRoleMappings();
      log('Removed role mapping: ' + discordRoleId);
    };

    // Bot settings functions
    window.saveBotSettings = async function() {
      const settings = {
        autoLogIC: document.getElementById('setting-autolog-ic')?.checked ?? true,
        defaultMode: document.getElementById('setting-default-mode')?.value ?? 'ic',
        diceNotify: document.getElementById('setting-dice-notify')?.checked ?? true,
        autoSession: document.getElementById('setting-auto-session')?.checked ?? false,
        reminderTime: parseInt(document.getElementById('setting-reminder-time')?.value ?? '60'),
      };

      log('Saving bot settings...');

      try {
        const response = await fetch('/.proxy/api/guilds/' + discordContext.guildId + '/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelLinks,
            roleMappings,
            botSettings: settings
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save settings');
        }

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
  `;
}

/**
 * Discord SDK initialization and main flow
 */
export function getMainScript(): string {
  return `
    // Store SDK instance globally for settings access
    window.discordSdkInstance = null;

    async function main() {
      try {
        // Step 1: Initialize the SDK
        log('Initializing Discord SDK...');
        setStatus('Connecting to Discord...');
        const discordSdk = new DiscordSDK(CLIENT_ID);
        window.discordSdkInstance = discordSdk;

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

        currentUser = auth.user;
        discordContext = {
          guildId: discordSdk.guildId,
          channelId: discordSdk.channelId,
          instanceId: discordSdk.instanceId,
        };

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
          // Show waiting for admin view
          setStatus('Waiting for session...', 'waiting');
          statusEl.style.display = 'none';
          waitingContainer.style.display = 'block';
          return;
        }

        // Step 7: Show admin dashboard
        statusEl.style.display = 'none';
        usernameEl.textContent = auth.user.username;
        adminDashboard.style.display = 'block';

        // Load systems first, then campaigns
        await loadSystems();
        await loadCampaigns();

      } catch (error) {
        console.error('Activity initialization failed:', error);
        log('ERROR: ' + error.message);
        setStatus('Error: ' + error.message, 'error');
      }
    }

    main();
  `;
}

/**
 * Get all scripts combined with client ID injected
 */
export function getAllScripts(clientId: string): string {
  const scripts = [
    getCoreScript(),
    getModalScript(),
    getSystemScript(),
    getCampaignScript(),
    getSettingsScript(),
    getMainScript(),
  ].join('\n');

  return scripts.replace(/__CLIENT_ID__/g, clientId);
}
