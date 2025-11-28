/**
 * Shared styles for Discord Activity views
 */

export function getBaseStyles(): string {
  return `
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
      max-width: 800px;
      padding: 40px 20px;
      width: 100%;
    }
    h1 {
      font-size: 48px;
      margin: 0 0 20px 0;
    }
  `;
}

export function getStatusStyles(): string {
  return `
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
    .status.waiting { background: #5865f2; }
  `;
}

export function getWaitingStyles(): string {
  return `
    .waiting-container {
      display: none;
      text-align: center;
      padding: 60px 20px;
    }
    .waiting-container .spinner {
      width: 60px;
      height: 60px;
      border: 4px solid #383a40;
      border-top-color: #5865f2;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 30px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .waiting-container h2 {
      font-size: 28px;
      margin: 0 0 15px 0;
      color: #ffffff;
    }
    .waiting-container p {
      font-size: 16px;
      color: #b5bac1;
      margin: 0;
    }
  `;
}

export function getDashboardStyles(): string {
  return `
    .admin-dashboard {
      display: none;
      text-align: left;
    }
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid #383a40;
    }
    .dashboard-header h2 {
      margin: 0;
      font-size: 24px;
    }
    .user-badge {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 16px;
      background: #383a40;
      border-radius: 20px;
      font-size: 14px;
    }
    .user-badge .admin-tag {
      background: #248046;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
    }
    .dashboard-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .btn-icon {
      display: flex;
      align-items: center;
      gap: 6px;
    }
  `;
}

export function getCampaignCardStyles(): string {
  return `
    .campaigns-section h3 {
      font-size: 18px;
      margin: 0 0 15px 0;
      color: #b5bac1;
    }
    .campaign-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 30px;
    }
    .campaign-card {
      background: #383a40;
      border-radius: 8px;
      padding: 20px;
      cursor: pointer;
      transition: background 0.2s, transform 0.2s;
    }
    .campaign-card:hover {
      background: #404249;
      transform: translateY(-2px);
    }
    .campaign-card.create-new {
      border: 2px dashed #5865f2;
      background: transparent;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 150px;
    }
    .campaign-card.create-new:hover {
      background: rgba(88, 101, 242, 0.1);
    }
    .campaign-card .card-title {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 8px 0;
    }
    .campaign-card .card-system {
      font-size: 12px;
      color: #b5bac1;
      background: #1e1f22;
      padding: 4px 8px;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 10px;
    }
    .campaign-card .card-description {
      font-size: 14px;
      color: #b5bac1;
      margin: 0;
    }
    .campaign-card .card-status {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #4a4d55;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .campaign-card .status-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
    }
    .campaign-card .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .campaign-card .status-dot.stopped { background: #80848e; }
    .campaign-card .status-dot.running { background: #23a55a; }
    .campaign-card .status-dot.starting { background: #f0b232; animation: pulse 1s infinite; }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .create-icon {
      font-size: 48px;
      color: #5865f2;
      margin-bottom: 10px;
    }
  `;
}

export function getModalStyles(): string {
  return `
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .modal {
      background: #2b2d31;
      border-radius: 8px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
    }
    .modal h3 {
      margin: 0 0 20px 0;
      font-size: 20px;
    }
  `;
}

export function getFormStyles(): string {
  return `
    .form-group {
      margin-bottom: 16px;
    }
    .form-group label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #b5bac1;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    .form-group input,
    .form-group select,
    .form-group textarea {
      width: 100%;
      padding: 10px 12px;
      background: #1e1f22;
      border: none;
      border-radius: 4px;
      color: #ffffff;
      font-size: 14px;
      font-family: inherit;
    }
    .form-group textarea {
      resize: vertical;
      min-height: 80px;
    }
    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
      outline: 2px solid #5865f2;
    }
    .modal-buttons {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
    }
  `;
}

export function getButtonStyles(): string {
  return `
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-secondary {
      background: #383a40;
      color: #ffffff;
    }
    .btn-secondary:hover {
      background: #404249;
    }
    .btn-primary {
      background: #5865f2;
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #4752c4;
    }
  `;
}

export function getDebugStyles(): string {
  return `
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
  `;
}

export function getChannelLinkingStyles(): string {
  return `
    /* Channel Linking Panel */
    .channel-linking-panel {
      padding: 20px 0;
    }
    .channel-linking-panel .panel-header {
      margin-bottom: 20px;
    }
    .channel-linking-panel .panel-header h4 {
      margin: 0 0 8px 0;
      font-size: 18px;
    }
    .channel-linking-panel .help-text {
      color: #b5bac1;
      font-size: 14px;
      margin: 0;
    }

    .channel-links-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .channel-link-card {
      display: grid;
      grid-template-columns: 48px 1fr 200px 80px;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: #383a40;
      border-radius: 8px;
      transition: background 0.2s;
    }
    .channel-link-card:hover {
      background: #404249;
    }

    .channel-link-icon {
      font-size: 24px;
      text-align: center;
    }

    .channel-link-info {
      min-width: 0;
    }
    .channel-link-title {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 4px;
    }
    .channel-link-description {
      font-size: 12px;
      color: #b5bac1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .channel-link-select select {
      width: 100%;
      padding: 8px 12px;
      background: #1e1f22;
      border: none;
      border-radius: 4px;
      color: #ffffff;
      font-size: 13px;
      cursor: pointer;
    }
    .channel-link-select select:focus {
      outline: 2px solid #5865f2;
    }

    .channel-link-status {
      font-size: 12px;
      text-align: center;
    }
    .channel-link-status.linked {
      color: #23a55a;
    }
    .channel-link-status.unlinked {
      color: #80848e;
    }

    .channel-links-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #383a40;
    }

    /* Role Linking Panel */
    .role-linking-panel {
      padding: 20px 0;
    }
    .role-linking-panel .panel-header {
      margin-bottom: 20px;
    }
    .role-linking-panel .panel-header h4 {
      margin: 0 0 8px 0;
      font-size: 18px;
    }

    .role-mappings-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .role-mapping-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #383a40;
      border-radius: 8px;
    }
    .role-mapping-item .discord-role {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .role-mapping-item .role-color {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    .role-mapping-item .mapping-arrow {
      color: #5865f2;
      font-weight: bold;
    }
    .role-mapping-item .foundry-role {
      flex: 1;
      color: #b5bac1;
    }
    .role-mapping-item .remove-btn {
      background: none;
      border: none;
      color: #ed4245;
      cursor: pointer;
      padding: 4px 8px;
      font-size: 16px;
    }
    .role-mapping-item .remove-btn:hover {
      background: rgba(237, 66, 69, 0.1);
      border-radius: 4px;
    }

    .add-role-mapping {
      padding: 16px;
      background: #2b2d31;
      border: 2px dashed #383a40;
      border-radius: 8px;
    }
    .add-role-mapping .mapping-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .add-role-mapping .mapping-arrow {
      color: #5865f2;
      font-weight: bold;
    }
    .add-role-mapping .role-select {
      flex: 1;
      padding: 8px 12px;
      background: #1e1f22;
      border: none;
      border-radius: 4px;
      color: #ffffff;
      font-size: 13px;
    }

    /* Server Settings Panel */
    .server-settings-panel {
      text-align: left;
    }
    .server-settings-panel .panel-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #383a40;
    }
    .server-settings-panel .panel-header h3 {
      margin: 0;
      font-size: 20px;
    }

    .settings-tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 24px;
      padding: 4px;
      background: #1e1f22;
      border-radius: 8px;
    }
    .settings-tab {
      flex: 1;
      padding: 10px 16px;
      background: transparent;
      border: none;
      border-radius: 6px;
      color: #b5bac1;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .settings-tab:hover {
      color: #ffffff;
      background: #383a40;
    }
    .settings-tab.active {
      background: #5865f2;
      color: #ffffff;
    }

    .settings-tab-content {
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Bot Settings */
    .bot-settings-section {
      margin-bottom: 32px;
    }
    .bot-settings-section h4 {
      font-size: 16px;
      margin: 0 0 16px 0;
      padding-bottom: 8px;
      border-bottom: 1px solid #383a40;
    }

    .setting-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: #383a40;
      border-radius: 8px;
      margin-bottom: 8px;
    }
    .setting-info {
      flex: 1;
    }
    .setting-info label {
      display: block;
      font-weight: 500;
      margin-bottom: 4px;
    }
    .setting-description {
      font-size: 12px;
      color: #b5bac1;
      margin: 0;
    }

    /* Toggle Switch */
    .toggle {
      position: relative;
      display: inline-block;
      width: 48px;
      height: 24px;
    }
    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #4f545c;
      transition: 0.3s;
      border-radius: 24px;
    }
    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: 0.3s;
      border-radius: 50%;
    }
    .toggle input:checked + .toggle-slider {
      background-color: #23a55a;
    }
    .toggle input:checked + .toggle-slider:before {
      transform: translateX(24px);
    }

    .settings-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #383a40;
    }
  `;
}

/**
 * Get all Discord Activity styles combined
 */
export function getAllStyles(): string {
  return [
    getBaseStyles(),
    getStatusStyles(),
    getWaitingStyles(),
    getDashboardStyles(),
    getCampaignCardStyles(),
    getModalStyles(),
    getFormStyles(),
    getButtonStyles(),
    getDebugStyles(),
    getChannelLinkingStyles(),
  ].join('\n');
}
