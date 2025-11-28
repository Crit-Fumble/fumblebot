/**
 * Web Dashboard View
 * HTML template for the web browser interface
 */

import type { PlatformContext } from '../models/types.js';

/**
 * Generate Web Dashboard HTML page
 * Full-page dashboard with OAuth2 redirect flow
 */
export function getWebDashboardHtml(
  clientId: string,
  publicUrl: string,
  ctx: PlatformContext
): string {
  const platformClass = ctx.isMobile ? 'mobile' : 'desktop';
  const platformName = ctx.platform.charAt(0).toUpperCase() + ctx.platform.slice(1);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <title>FumbleBot - Admin Dashboard</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: #ffffff;
      min-height: 100vh;
    }
    .nav {
      background: rgba(0, 0, 0, 0.3);
      padding: 15px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .nav-brand {
      font-size: 24px;
      font-weight: bold;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .nav-brand img {
      width: 32px;
      height: 32px;
    }
    .nav-actions {
      display: flex;
      gap: 15px;
    }
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
    }
    .btn-primary {
      background: #5865f2;
      color: white;
    }
    .btn-primary:hover {
      background: #4752c4;
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .hero {
      text-align: center;
      padding: 60px 20px;
    }
    .hero h1 {
      font-size: 48px;
      margin: 0 0 20px 0;
      background: linear-gradient(135deg, #5865f2 0%, #eb459e 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero p {
      font-size: 18px;
      color: #b5bac1;
      margin: 0 0 30px 0;
    }
    .status-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 30px;
      margin: 20px 0;
    }
    .status-card h2 {
      margin: 0 0 15px 0;
      font-size: 20px;
    }
    .status-card p {
      margin: 0;
      color: #b5bac1;
    }
    .platform-badge {
      display: inline-block;
      padding: 5px 12px;
      background: rgba(88, 101, 242, 0.2);
      border: 1px solid #5865f2;
      border-radius: 20px;
      font-size: 12px;
      margin-bottom: 20px;
    }
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-top: 40px;
    }
    .feature-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 25px;
      transition: transform 0.2s ease, border-color 0.2s ease;
    }
    .feature-card:hover {
      transform: translateY(-2px);
      border-color: rgba(88, 101, 242, 0.5);
    }
    .feature-card h3 {
      margin: 0 0 10px 0;
      font-size: 18px;
    }
    .feature-card p {
      margin: 0;
      color: #b5bac1;
      font-size: 14px;
    }
    .feature-icon {
      font-size: 32px;
      margin-bottom: 15px;
    }
    .auth-status {
      padding: 20px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      text-align: center;
      margin-top: 30px;
    }
    .auth-status.authenticated {
      background: rgba(36, 128, 70, 0.2);
      border: 1px solid rgba(36, 128, 70, 0.5);
    }
    .mobile .nav { flex-direction: column; gap: 15px; }
    .mobile .hero h1 { font-size: 32px; }
    .mobile .features-grid { grid-template-columns: 1fr; }
    .footer {
      text-align: center;
      padding: 40px 20px;
      color: #b5bac1;
      font-size: 14px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      margin-top: 60px;
    }
  </style>
</head>
<body class="${platformClass}">
  <nav class="nav">
    <div class="nav-brand">
      <span>🎲</span>
      <span>FumbleBot</span>
    </div>
    <div class="nav-actions">
      <button id="discord-login" class="btn btn-primary">Login with Discord</button>
    </div>
  </nav>

  <div class="container">
    <div class="hero">
      <span class="platform-badge">Platform: ${platformName}</span>
      <h1>FumbleBot Admin Dashboard</h1>
      <p>Manage your Discord gaming sessions, Foundry VTT instances, and AI-powered tools</p>
    </div>

    <div class="status-card">
      <h2>Current Status</h2>
      <p id="auth-message">Sign in with Discord to access admin features.</p>
    </div>

    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-icon">🎮</div>
        <h3>Session Management</h3>
        <p>Create and manage gaming sessions linked to Discord voice channels.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🏰</div>
        <h3>Foundry VTT</h3>
        <p>Launch and configure Foundry VTT instances for your campaigns.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🤖</div>
        <h3>AI Assistant</h3>
        <p>Access AI-powered tools for NPCs, encounters, and story generation.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">📊</div>
        <h3>Analytics</h3>
        <p>Track session history, player activity, and campaign progress.</p>
      </div>
    </div>

    <div id="user-section" style="display: none;">
      <div class="auth-status authenticated">
        <p id="user-info">Logged in</p>
      </div>
    </div>
  </div>

  <footer class="footer">
    <p>FumbleBot &copy; 2024 Crit-Fumble | Coming March 2026</p>
    <p style="margin-top: 10px; font-size: 12px;">
      Works on Discord, Web, iOS, and Android
    </p>
  </footer>

  <script>
    const CLIENT_ID = '${clientId}';
    const REDIRECT_URI = '${publicUrl}/auth/callback';

    const discordLoginBtn = document.getElementById('discord-login');
    const authMessage = document.getElementById('auth-message');
    const userSection = document.getElementById('user-section');
    const userInfo = document.getElementById('user-info');

    // Check for existing auth in localStorage
    function checkAuth() {
      const stored = localStorage.getItem('fumblebot_auth');
      if (stored) {
        try {
          const auth = JSON.parse(stored);
          // Check if token is expired
          if (auth.expires_at && auth.expires_at > Date.now()) {
            showAuthenticatedState(auth.user);
            return true;
          } else {
            // Token expired, clear it
            localStorage.removeItem('fumblebot_auth');
          }
        } catch (e) {
          console.log('Invalid auth data');
          localStorage.removeItem('fumblebot_auth');
        }
      }
      return false;
    }

    function showAuthenticatedState(user) {
      discordLoginBtn.textContent = 'Logged in as ' + user.username;
      discordLoginBtn.classList.add('btn-secondary');
      discordLoginBtn.classList.remove('btn-primary');
      authMessage.textContent = 'Welcome back, ' + user.username + '! You have admin access.';
      userSection.style.display = 'block';
      userInfo.textContent = 'User ID: ' + user.id;

      // Change button to logout
      discordLoginBtn.textContent = 'Logout';
      discordLoginBtn.onclick = logout;
    }

    function logout() {
      localStorage.removeItem('fumblebot_auth');
      window.location.reload();
    }

    // Discord OAuth2 redirect flow (for web, not Activity SDK)
    discordLoginBtn.addEventListener('click', () => {
      const scope = 'identify guilds guilds.members.read';
      const authUrl = 'https://discord.com/api/oauth2/authorize' +
        '?client_id=' + CLIENT_ID +
        '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) +
        '&response_type=code' +
        '&scope=' + encodeURIComponent(scope);

      window.location.href = authUrl;
    });

    // Check auth on load
    checkAuth();
  </script>
</body>
</html>
  `;
}
