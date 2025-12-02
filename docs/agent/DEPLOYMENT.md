# FumbleBot Deployment Guide

## Overview

FumbleBot supports two deployment methods:
1. **Git-based deployment** (recommended) - Pull changes directly on the server
2. **SCP-based deployment** (legacy) - Upload built files from local machine

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run push` | Push to GitHub + auto-deploy if on main |
| `npm run deploy:git` | Pull latest changes on server and deploy |
| `npm run deploy` | Legacy SCP-based deployment |
| `npm run deploy:setup` | One-time setup for Git-based deployment |

## Git-Based Deployment (Recommended)

This method keeps a Git repo on the server and pulls changes directly. It's faster and more reliable.

### Initial Setup (One-Time)

1. **Run the setup script:**
   ```bash
   npm run deploy:setup
   ```

2. **Follow the prompts to:**
   - Generate an SSH deploy key on the server
   - Add the deploy key to your GitHub repo (Settings → Deploy Keys)
   - Clone the repo on the server
   - Run initial deployment

### Deploying Changes

**Easiest way** - push and deploy in one command:

```bash
npm run push
```

This pushes to GitHub (running Husky security scan) and automatically deploys if on `main`.

**Alternative** - manual two-step:

```bash
git push origin main
npm run deploy:git
```

The deploy SSHs to the server and runs:
- `git pull origin main`
- `npm ci`
- `npm run build`
- `npx prisma generate`
- `systemctl restart fumblebot`

### What Happens on the Server

The [server-deploy.sh](../scripts/server-deploy.sh) script:
1. Checks if there are new changes (skips if already up-to-date)
2. Pulls latest code from GitHub
3. Installs dependencies
4. Builds TypeScript
5. Generates Prisma client
6. Restarts the systemd service
7. Runs health check

Logs are written to `/root/fumblebot/deploy.log`.

## Automatic Deployments (GitHub Webhook)

For fully automatic deployments when you push to `main`:

### Setup

1. **Run the webhook setup:**
   ```bash
   bash scripts/setup-webhook.sh
   ```

2. **Save the generated webhook secret**

3. **Add webhook in GitHub:**
   - Go to repo Settings → Webhooks → Add webhook
   - Payload URL: `http://159.203.126.144:9000/hooks/fumblebot-deploy`
   - Content type: `application/json`
   - Secret: (use the generated secret)
   - Events: Just the push event

4. **Open firewall port (if needed):**
   ```bash
   ssh root@159.203.126.144 'ufw allow 9000/tcp'
   ```

### How It Works

1. You push to `main` branch
2. GitHub sends webhook to the server
3. Webhook verifies signature and triggers deployment
4. Server pulls changes, builds, and restarts

## Legacy SCP Deployment

The original method uploads pre-built files via SCP:

```bash
npm run deploy
```

This runs [deploy.sh](../scripts/deploy.sh) which:
1. Runs security scan locally
2. Builds TypeScript locally
3. Runs tests locally
4. SCPs `dist/`, `prisma/`, `package.json`, `package-lock.json`
5. Installs dependencies on server
6. Restarts service

Use this if Git-based deployment isn't working.

## Server Details

- **IP:** 159.203.126.144
- **User:** root
- **App Directory:** /root/fumblebot
- **Service:** fumblebot (systemd)
- **Port:** 3000 (internal), 443 (HTTPS via nginx)

### Useful Commands

```bash
# Check service status
ssh root@159.203.126.144 'systemctl status fumblebot'

# View logs
ssh root@159.203.126.144 'tail -100 /root/fumblebot/fumblebot.log'

# View deployment logs
ssh root@159.203.126.144 'tail -100 /root/fumblebot/deploy.log'

# Restart service manually
ssh root@159.203.126.144 'systemctl restart fumblebot'

# Check webhook service
ssh root@159.203.126.144 'systemctl status fumblebot-webhook'
```

## Troubleshooting

### Deployment fails with "Git pull failed"
- Check if there are uncommitted changes on the server
- SSH in and resolve manually: `cd /root/fumblebot && git status`

### Service won't start
- Check logs: `journalctl -u fumblebot -n 50`
- Check app logs: `tail -100 /root/fumblebot/fumblebot.log`
- Verify .env file exists: `ls -la /root/fumblebot/.env`

### Webhook not triggering
- Check webhook service: `systemctl status fumblebot-webhook`
- Check firewall: `ufw status`
- Verify webhook secret matches GitHub config
- Check webhook logs: `journalctl -u fumblebot-webhook -n 50`

### Build fails on server
- Ensure Node.js version is compatible (>=18)
- Check disk space: `df -h`
- Try cleaning and reinstalling: `rm -rf node_modules && npm install`
