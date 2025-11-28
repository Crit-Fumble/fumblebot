#!/bin/bash
# FumbleBot Server-Side Deploy Script
# This script runs ON the droplet to pull latest changes and deploy
# Can be triggered manually via SSH or by a webhook

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="/root/fumblebot"
LOG_FILE="/root/fumblebot/deploy.log"
LOCK_FILE="/tmp/fumblebot-deploy.lock"

# Logging function
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Check for lock file to prevent concurrent deployments
if [ -f "$LOCK_FILE" ]; then
    log "${RED}Deployment already in progress. Exiting.${NC}"
    exit 1
fi

# Create lock file
trap "rm -f $LOCK_FILE" EXIT
touch "$LOCK_FILE"

log ""
log "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log "${BLUE}     FumbleBot Server Deploy - $(date)${NC}"
log "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log ""

cd "$APP_DIR"

# Step 1: Fetch and check for changes
log "${YELLOW}Step 1/5: Fetching latest changes...${NC}"
git fetch origin main

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    log "${GREEN}Already up to date. No deployment needed.${NC}"
    exit 0
fi

log "Current: $LOCAL"
log "Remote:  $REMOTE"
log ""

# Step 2: Pull changes
log "${YELLOW}Step 2/5: Pulling changes from origin/main...${NC}"
git pull origin main
if [ $? -ne 0 ]; then
    log "${RED}Git pull failed${NC}"
    exit 1
fi
log "${GREEN}Changes pulled successfully${NC}"
log ""

# Step 3: Install dependencies
log "${YELLOW}Step 3/5: Installing dependencies...${NC}"
npm ci --production=false 2>/dev/null || npm install
if [ $? -ne 0 ]; then
    log "${RED}npm install failed${NC}"
    exit 1
fi
log "${GREEN}Dependencies installed${NC}"
log ""

# Step 4: Build and setup
log "${YELLOW}Step 4/5: Building application...${NC}"
npm run build
if [ $? -ne 0 ]; then
    log "${RED}Build failed${NC}"
    exit 1
fi

log "Generating Prisma client..."
npx prisma generate --schema=prisma/schema.prisma

log "Creating node_modules symlink..."
ln -sf ../node_modules dist/node_modules 2>/dev/null || true

log "${GREEN}Build complete${NC}"
log ""

# Step 5: Restart service
log "${YELLOW}Step 5/5: Restarting service...${NC}"
systemctl restart fumblebot

log "Waiting for service to start..."
sleep 5

# Health check
if systemctl is-active --quiet fumblebot; then
    log "${GREEN}FumbleBot service is running${NC}"

    # Check health endpoint
    HEALTH=$(curl -s http://localhost:3000/health 2>/dev/null || echo "")
    if echo "$HEALTH" | grep -q '"status":"ok"'; then
        log "${GREEN}Health check passed${NC}"
    else
        log "${YELLOW}Health endpoint not responding (service may still be starting)${NC}"
    fi
else
    log "${RED}FumbleBot service failed to start${NC}"
    systemctl status fumblebot --no-pager | head -20 | tee -a "$LOG_FILE"
    tail -50 /root/fumblebot/fumblebot.log | tee -a "$LOG_FILE"
    exit 1
fi

log ""
log "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log "${GREEN}     Deployment Complete! $(date)${NC}"
log "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
