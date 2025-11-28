/**
 * Reusable HTML components for Discord Activity views
 */

/**
 * Waiting for Admin view (shown to non-admin users)
 */
export function getWaitingView(): string {
  return `
    <div id="waiting-container" class="waiting-container">
      <div class="spinner"></div>
      <h2>Waiting for Admin...</h2>
      <p>An administrator needs to start a campaign session.</p>
    </div>
  `;
}

/**
 * Admin dashboard header with user badge and settings
 */
export function getDashboardHeader(): string {
  return `
    <div class="dashboard-header">
      <h2>Campaign Dashboard</h2>
      <div class="dashboard-actions">
        <button class="btn btn-secondary btn-icon" onclick="showServerSettings()" title="Server Settings">
          ⚙️ Settings
        </button>
        <div id="user-badge" class="user-badge">
          <span id="username"></span>
          <span class="admin-tag">Admin</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Campaign grid section
 */
export function getCampaignGrid(): string {
  return `
    <div class="campaigns-section">
      <h3>Your Campaigns</h3>
      <div id="campaign-grid" class="campaign-grid">
        <!-- Campaign cards will be inserted here -->
        <div class="campaign-card create-new" onclick="showCreateModal()">
          <div class="create-icon">+</div>
          <div class="card-title">Create Campaign</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * System selection form group with manifest URL support
 */
export function getSystemSelector(): string {
  return `
    <div class="form-group">
      <label for="campaign-system">Game System</label>
      <select id="campaign-system" onchange="handleSystemChange()">
        <option value="">-- Select a system --</option>
        <!-- Systems loaded from API -->
      </select>
      <div id="add-system-section" style="display: none; margin-top: 12px;">
        <label style="font-size: 11px; margin-bottom: 6px; display: block;">
          Manifest URL <span style="color: #80848e; font-weight: normal;">(paste from foundryvtt.com)</span>
        </label>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="manifest-url" placeholder="https://github.com/...system.json" style="flex: 1;">
          <button type="button" class="btn btn-secondary" onclick="previewManifest()">Preview</button>
        </div>
      </div>
      <div id="system-preview" style="display: none; margin-top: 12px; padding: 12px; background: #1e1f22; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <div id="preview-title" style="font-weight: 600; margin-bottom: 4px;"></div>
            <div id="preview-version" style="font-size: 12px; color: #80848e;"></div>
          </div>
          <button type="button" class="btn btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="addPreviewedSystem()">Add System</button>
        </div>
        <div id="preview-description" style="font-size: 13px; color: #b5bac1; margin-top: 8px;"></div>
      </div>
    </div>
  `;
}

/**
 * Create Campaign Modal
 */
export function getCreateCampaignModal(): string {
  return `
    <div id="create-modal" class="modal-overlay" onclick="hideCreateModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <h3>Create New Campaign</h3>
        <form id="create-form" onsubmit="handleCreateCampaign(event)">
          <div class="form-group">
            <label for="campaign-name">Campaign Name</label>
            <input type="text" id="campaign-name" placeholder="e.g., Curse of Strahd" required>
          </div>
          ${getSystemSelector()}
          <div class="form-group">
            <label for="campaign-description">Description (Optional)</label>
            <textarea id="campaign-description" placeholder="Brief description of your campaign..."></textarea>
          </div>
          <div class="modal-buttons">
            <button type="button" class="btn btn-secondary" onclick="hideCreateModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Campaign</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

/**
 * Admin Dashboard complete view
 */
export function getAdminDashboard(): string {
  return `
    <div id="admin-dashboard" class="admin-dashboard">
      ${getDashboardHeader()}
      ${getCampaignGrid()}
    </div>
  `;
}

/**
 * Debug info panel
 */
export function getDebugPanel(): string {
  return `
    <div id="debug" class="debug-info" style="display:none;"></div>
  `;
}

/**
 * Campaign card template (for JavaScript rendering)
 */
export function getCampaignCardTemplate(): string {
  return `
    <div class="campaign-card">
      <div class="card-title">\${name}</div>
      <div class="card-system">\${systemTitle}</div>
      <p class="card-description">\${description || 'No description'}</p>
      <div class="card-status">
        <div class="status-indicator">
          <div class="status-dot \${status}"></div>
          <span>\${statusLabel}</span>
        </div>
        <button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px;">Launch</button>
      </div>
    </div>
  `;
}

/**
 * Tab navigation for campaign detail view
 */
export function getCampaignTabs(): string {
  return `
    <div class="tab-nav">
      <button class="tab-btn active" data-tab="overview">Overview</button>
      <button class="tab-btn" data-tab="characters">Characters</button>
      <button class="tab-btn" data-tab="sessions">Sessions</button>
      <button class="tab-btn" data-tab="members">Members</button>
      <button class="tab-btn" data-tab="settings">Settings</button>
    </div>
  `;
}

/**
 * Character list panel
 */
export function getCharacterPanel(): string {
  return `
    <div id="characters-panel" class="tab-panel" style="display: none;">
      <div class="panel-header">
        <h4>Characters</h4>
        <button class="btn btn-secondary btn-sm" onclick="showAddCharacterModal()">+ Add Character</button>
      </div>
      <div class="character-filters">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="pc">PCs</button>
        <button class="filter-btn" data-filter="npc">NPCs</button>
        <button class="filter-btn" data-filter="companion">Companions</button>
      </div>
      <div id="character-list" class="character-list">
        <!-- Character cards loaded dynamically -->
      </div>
    </div>
  `;
}

/**
 * Session management panel
 */
export function getSessionPanel(): string {
  return `
    <div id="sessions-panel" class="tab-panel" style="display: none;">
      <div class="panel-header">
        <h4>Game Sessions</h4>
        <button class="btn btn-primary btn-sm" onclick="startNewSession()">Start Session</button>
      </div>
      <div id="active-session" class="active-session" style="display: none;">
        <div class="session-status">
          <span class="status-badge live">LIVE</span>
          <span id="session-name">Current Session</span>
          <span id="session-duration">0:00:00</span>
        </div>
        <div class="session-controls">
          <button class="btn btn-secondary btn-sm" onclick="pauseSession()">Pause</button>
          <button class="btn btn-danger btn-sm" onclick="endSession()">End Session</button>
        </div>
      </div>
      <div class="session-history">
        <h5>Session History</h5>
        <div id="session-list" class="session-list">
          <!-- Past sessions loaded dynamically -->
        </div>
      </div>
    </div>
  `;
}

/**
 * Members management panel
 */
export function getMembersPanel(): string {
  return `
    <div id="members-panel" class="tab-panel" style="display: none;">
      <div class="panel-header">
        <h4>Campaign Members</h4>
        <button class="btn btn-secondary btn-sm" onclick="showInviteModal()">Invite</button>
      </div>
      <div id="members-list" class="members-list">
        <!-- Member rows loaded dynamically -->
      </div>
      <div class="role-mappings">
        <h5>Discord Role Mappings</h5>
        <p class="help-text">Link Discord roles to Foundry permissions</p>
        <div id="role-mappings-list">
          <!-- Role mapping rows loaded dynamically -->
        </div>
        <button class="btn btn-secondary btn-sm" onclick="showAddRoleMappingModal()">+ Add Mapping</button>
      </div>
    </div>
  `;
}

/**
 * Campaign settings panel
 */
export function getSettingsPanel(): string {
  return `
    <div id="settings-panel" class="tab-panel" style="display: none;">
      <div class="panel-header">
        <h4>Campaign Settings</h4>
      </div>
      <div class="settings-section">
        <h5>General</h5>
        <div class="form-group">
          <label>Campaign Name</label>
          <input type="text" id="settings-name" class="form-input">
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="settings-description" class="form-textarea"></textarea>
        </div>
      </div>
      <div class="settings-section">
        <h5>Session Tracking</h5>
        <div class="setting-row">
          <label>Auto-log messages during sessions</label>
          <input type="checkbox" id="settings-autolog" checked>
        </div>
        <div class="setting-row">
          <label>Default message mode</label>
          <select id="settings-default-mode">
            <option value="ic">In-Character (IC)</option>
            <option value="ooc">Out-of-Character (OOC)</option>
          </select>
        </div>
      </div>
      <div class="settings-section danger-zone">
        <h5>Danger Zone</h5>
        <button class="btn btn-danger" onclick="confirmDeleteCampaign()">Delete Campaign</button>
      </div>
    </div>
  `;
}

/**
 * Campaign detail view (replaces grid when viewing a campaign)
 */
export function getCampaignDetailView(): string {
  return `
    <div id="campaign-detail" class="campaign-detail" style="display: none;">
      <div class="detail-header">
        <button class="btn btn-link" onclick="backToCampaignList()">← Back</button>
        <div class="campaign-info">
          <h3 id="detail-campaign-name"></h3>
          <span id="detail-campaign-system" class="system-badge"></span>
        </div>
        <div class="campaign-actions">
          <button class="btn btn-primary" id="launch-foundry-btn" onclick="launchFoundry()">Launch Foundry</button>
        </div>
      </div>
      ${getCampaignTabs()}
      <div class="tab-content">
        <div id="overview-panel" class="tab-panel">
          <div class="overview-grid">
            <div class="stat-card">
              <div class="stat-value" id="stat-members">0</div>
              <div class="stat-label">Members</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" id="stat-characters">0</div>
              <div class="stat-label">Characters</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" id="stat-sessions">0</div>
              <div class="stat-label">Sessions</div>
            </div>
          </div>
          <div class="recent-activity">
            <h5>Recent Activity</h5>
            <div id="activity-feed" class="activity-feed">
              <!-- Activity items loaded dynamically -->
            </div>
          </div>
        </div>
        ${getCharacterPanel()}
        ${getSessionPanel()}
        ${getMembersPanel()}
        ${getSettingsPanel()}
      </div>
    </div>
  `;
}

/**
 * Add Character Modal
 */
export function getAddCharacterModal(): string {
  return `
    <div id="add-character-modal" class="modal-overlay" style="display: none;" onclick="hideAddCharacterModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <h3>Add Character</h3>
        <form id="add-character-form" onsubmit="handleAddCharacter(event)">
          <div class="form-group">
            <label for="char-name">Character Name</label>
            <input type="text" id="char-name" required>
          </div>
          <div class="form-group">
            <label for="char-type">Type</label>
            <select id="char-type">
              <option value="pc">Player Character (PC)</option>
              <option value="npc">NPC</option>
              <option value="familiar">Familiar</option>
              <option value="companion">Companion</option>
              <option value="monster">Monster</option>
            </select>
          </div>
          <div class="form-group">
            <label for="char-owner">Owner</label>
            <select id="char-owner">
              <option value="fumblebot">FumbleBot (Bot-controlled)</option>
              <!-- Player options loaded dynamically -->
            </select>
          </div>
          <div class="form-group">
            <label for="char-avatar">Avatar URL (Optional)</label>
            <input type="url" id="char-avatar" placeholder="https://...">
          </div>
          <div class="modal-buttons">
            <button type="button" class="btn btn-secondary" onclick="hideAddCharacterModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Add Character</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

/**
 * Player view - shown to non-admin users who are campaign members
 */
export function getPlayerView(): string {
  return `
    <div id="player-view" class="player-view" style="display: none;">
      <div class="player-header">
        <h2>Welcome, <span id="player-name"></span></h2>
        <div id="active-character" class="active-character">
          <img id="char-avatar" class="char-avatar" src="" alt="">
          <div class="char-info">
            <span id="char-name-display">No character selected</span>
            <button class="btn btn-link btn-sm" onclick="showCharacterSelect()">Change</button>
          </div>
        </div>
      </div>
      <div class="player-actions">
        <button class="btn btn-primary" onclick="speakAsCharacter()">Speak as Character</button>
        <button class="btn btn-secondary" onclick="rollDice()">Roll Dice</button>
        <button class="btn btn-secondary" onclick="viewCharacterSheet()">View Sheet</button>
      </div>
      <div class="session-info">
        <div id="session-status-player" class="session-status-badge">
          No active session
        </div>
      </div>
    </div>
  `;
}

/**
 * Channel linking panel for campaign settings
 * Allows admins to link Discord channels to specific purposes
 */
export function getChannelLinkingPanel(): string {
  return `
    <div id="channel-linking-panel" class="channel-linking-panel">
      <div class="panel-header">
        <h4>Channel Links</h4>
        <p class="help-text">Link Discord channels to campaign functions</p>
      </div>

      <div class="channel-links-grid">
        <!-- IC Channel -->
        <div class="channel-link-card">
          <div class="channel-link-icon">💬</div>
          <div class="channel-link-info">
            <div class="channel-link-title">In-Character Chat</div>
            <div class="channel-link-description">Messages here are logged as character dialogue</div>
          </div>
          <div class="channel-link-select">
            <select id="link-ic-channel" onchange="updateChannelLink('ic', this.value)">
              <option value="">-- Not linked --</option>
            </select>
          </div>
          <div class="channel-link-status" id="link-ic-status"></div>
        </div>

        <!-- OOC Channel -->
        <div class="channel-link-card">
          <div class="channel-link-icon">🗨️</div>
          <div class="channel-link-info">
            <div class="channel-link-title">Out-of-Character</div>
            <div class="channel-link-description">Player discussion, separate from RP</div>
          </div>
          <div class="channel-link-select">
            <select id="link-ooc-channel" onchange="updateChannelLink('ooc', this.value)">
              <option value="">-- Not linked --</option>
            </select>
          </div>
          <div class="channel-link-status" id="link-ooc-status"></div>
        </div>

        <!-- Dice/Rolls Channel -->
        <div class="channel-link-card">
          <div class="channel-link-icon">🎲</div>
          <div class="channel-link-info">
            <div class="channel-link-title">Dice Rolls</div>
            <div class="channel-link-description">Dedicated channel for roll results</div>
          </div>
          <div class="channel-link-select">
            <select id="link-dice-channel" onchange="updateChannelLink('dice', this.value)">
              <option value="">-- Not linked --</option>
            </select>
          </div>
          <div class="channel-link-status" id="link-dice-status"></div>
        </div>

        <!-- GM Notes Channel -->
        <div class="channel-link-card">
          <div class="channel-link-icon">📝</div>
          <div class="channel-link-info">
            <div class="channel-link-title">GM Notes</div>
            <div class="channel-link-description">Private GM channel for session notes</div>
          </div>
          <div class="channel-link-select">
            <select id="link-gm-channel" onchange="updateChannelLink('gm', this.value)">
              <option value="">-- Not linked --</option>
            </select>
          </div>
          <div class="channel-link-status" id="link-gm-status"></div>
        </div>

        <!-- Announcements Channel -->
        <div class="channel-link-card">
          <div class="channel-link-icon">📢</div>
          <div class="channel-link-info">
            <div class="channel-link-title">Announcements</div>
            <div class="channel-link-description">Session schedules and campaign news</div>
          </div>
          <div class="channel-link-select">
            <select id="link-announce-channel" onchange="updateChannelLink('announce', this.value)">
              <option value="">-- Not linked --</option>
            </select>
          </div>
          <div class="channel-link-status" id="link-announce-status"></div>
        </div>

        <!-- Voice Channel -->
        <div class="channel-link-card">
          <div class="channel-link-icon">🎤</div>
          <div class="channel-link-info">
            <div class="channel-link-title">Voice Channel</div>
            <div class="channel-link-description">Default voice channel for sessions</div>
          </div>
          <div class="channel-link-select">
            <select id="link-voice-channel" onchange="updateChannelLink('voice', this.value)">
              <option value="">-- Not linked --</option>
            </select>
          </div>
          <div class="channel-link-status" id="link-voice-status"></div>
        </div>
      </div>

      <div class="channel-links-actions">
        <button class="btn btn-secondary" onclick="refreshChannelList()">
          🔄 Refresh Channels
        </button>
        <button class="btn btn-primary" onclick="saveChannelLinks()">
          💾 Save Links
        </button>
      </div>
    </div>
  `;
}

/**
 * Role linking panel for campaign settings
 * Maps Discord roles to Foundry permission levels
 */
export function getRoleLinkingPanel(): string {
  return `
    <div id="role-linking-panel" class="role-linking-panel">
      <div class="panel-header">
        <h4>Role Permissions</h4>
        <p class="help-text">Map Discord roles to Foundry VTT permission levels</p>
      </div>

      <div class="role-mappings-list" id="role-mappings-container">
        <!-- Role mappings loaded dynamically -->
      </div>

      <div class="add-role-mapping">
        <div class="mapping-row">
          <select id="new-discord-role" class="role-select">
            <option value="">Select Discord Role...</option>
          </select>
          <span class="mapping-arrow">→</span>
          <select id="new-foundry-role" class="role-select">
            <option value="">Select Permission...</option>
            <option value="1">Player</option>
            <option value="2">Trusted Player</option>
            <option value="3">Assistant GM</option>
            <option value="4">Game Master</option>
          </select>
          <button class="btn btn-primary btn-sm" onclick="addRoleMapping()">Add</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Server settings panel (guild-wide bot settings)
 */
export function getServerSettingsPanel(): string {
  return `
    <div id="server-settings-panel" class="server-settings-panel" style="display: none;">
      <div class="panel-header">
        <button class="btn btn-link" onclick="backToAdminDashboard()">← Back</button>
        <h3>Server Settings</h3>
      </div>

      <div class="settings-tabs">
        <button class="settings-tab active" data-settings-tab="channels" onclick="showSettingsTab('channels')">
          📺 Channels
        </button>
        <button class="settings-tab" data-settings-tab="roles" onclick="showSettingsTab('roles')">
          👥 Roles
        </button>
        <button class="settings-tab" data-settings-tab="bot" onclick="showSettingsTab('bot')">
          🤖 Bot Config
        </button>
      </div>

      <div class="settings-content">
        <!-- Channels Tab -->
        <div id="settings-channels-tab" class="settings-tab-content">
          ${getChannelLinkingPanel()}
        </div>

        <!-- Roles Tab -->
        <div id="settings-roles-tab" class="settings-tab-content" style="display: none;">
          ${getRoleLinkingPanel()}
        </div>

        <!-- Bot Config Tab -->
        <div id="settings-bot-tab" class="settings-tab-content" style="display: none;">
          <div class="bot-settings-section">
            <h4>Message Handling</h4>

            <div class="setting-row">
              <div class="setting-info">
                <label>Auto-log IC messages</label>
                <p class="setting-description">Automatically log messages in IC channel during sessions</p>
              </div>
              <label class="toggle">
                <input type="checkbox" id="setting-autolog-ic" checked>
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <label>Default message mode</label>
                <p class="setting-description">Default mode for messages in linked channels</p>
              </div>
              <select id="setting-default-mode">
                <option value="ic">In-Character</option>
                <option value="ooc">Out-of-Character</option>
              </select>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <label>Dice roll notifications</label>
                <p class="setting-description">Post roll results to dice channel</p>
              </div>
              <label class="toggle">
                <input type="checkbox" id="setting-dice-notify" checked>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="bot-settings-section">
            <h4>Session Management</h4>

            <div class="setting-row">
              <div class="setting-info">
                <label>Auto-start session</label>
                <p class="setting-description">Start session when GM joins voice channel</p>
              </div>
              <label class="toggle">
                <input type="checkbox" id="setting-auto-session">
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <label>Session reminders</label>
                <p class="setting-description">Post reminder before scheduled sessions</p>
              </div>
              <select id="setting-reminder-time">
                <option value="0">Disabled</option>
                <option value="15">15 minutes before</option>
                <option value="30">30 minutes before</option>
                <option value="60" selected>1 hour before</option>
                <option value="1440">1 day before</option>
              </select>
            </div>
          </div>

          <div class="settings-actions">
            <button class="btn btn-secondary" onclick="resetBotSettings()">Reset to Defaults</button>
            <button class="btn btn-primary" onclick="saveBotSettings()">Save Settings</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
