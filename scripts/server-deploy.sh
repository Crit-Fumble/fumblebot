#!/bin/bash
# FumbleBot Server-Side Deploy Script
# This script runs ON the droplet to pull latest changes and deploy
# Can be triggered manually via SSH or by a webhook
#
# Usage: bash scripts/server-deploy.sh [--force] [--clean]
#   --force: Force rebuild even if code is up to date
#   --clean: Fresh clone (backs up .env, removes repo, clones fresh, restores .env)

set -e

# Parse arguments
FORCE_DEPLOY=false
CLEAN_DEPLOY=false
for arg in "$@"; do
    case $arg in
        --force|-f)
            FORCE_DEPLOY=true
            shift
            ;;
        --clean|-c)
            CLEAN_DEPLOY=true
            FORCE_DEPLOY=true  # Clean implies force
            shift
            ;;
    esac
done

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration - can be overridden with environment variables
APP_DIR="${FUMBLEBOT_DIR:-/home/fumblebot/app}"
LOG_FILE="${APP_DIR}/deploy.log"
LOCK_FILE="/tmp/fumblebot-deploy.lock"

# Ensure app directory exists
if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}Error: $APP_DIR does not exist. Please clone the repository first.${NC}"
    exit 1
fi

# Ensure log file exists
touch "$LOG_FILE"

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

# Handle clean deploy if requested
if [ "$CLEAN_DEPLOY" = true ]; then
    log "${YELLOW}Clean deploy requested - performing fresh clone...${NC}"

    # Backup .env file
    if [ -f ".env" ]; then
        log "Backing up .env file..."
        cp .env /tmp/fumblebot-env-backup
    fi

    # Remove and re-clone
    cd /root
    rm -rf fumblebot
    git clone https://github.com/Crit-Fumble/fumblebot.git
    cd fumblebot

    # Restore .env file
    if [ -f "/tmp/fumblebot-env-backup" ]; then
        log "Restoring .env file..."
        mv /tmp/fumblebot-env-backup .env
    fi

    log "${GREEN}Fresh clone complete${NC}"
    log ""
fi

# Step 1: Fetch and check for changes
log "${YELLOW}Step 1/6: Fetching latest changes...${NC}"
git fetch origin main

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ] && [ "$FORCE_DEPLOY" = false ]; then
    log "${GREEN}Already up to date. No deployment needed.${NC}"
    log "${YELLOW}Use --force to rebuild anyway.${NC}"
    exit 0
fi

if [ "$LOCAL" = "$REMOTE" ] && [ "$FORCE_DEPLOY" = true ]; then
    log "${YELLOW}Code is up to date, but --force specified. Rebuilding...${NC}"
fi

log "Current: $LOCAL"
log "Remote:  $REMOTE"
log ""

# Step 2: Pull changes
log "${YELLOW}Step 2/6: Pulling changes from origin/main...${NC}"
git pull origin main
if [ $? -ne 0 ]; then
    log "${RED}Git pull failed${NC}"
    exit 1
fi
log "${GREEN}Changes pulled successfully${NC}"
log ""

# Step 3: Install dependencies
log "${YELLOW}Step 3/6: Installing dependencies...${NC}"
npm ci --production=false 2>/dev/null || npm install
if [ $? -ne 0 ]; then
    log "${RED}npm install failed${NC}"
    exit 1
fi

# Install activity client dependencies (React app in src/activity)
if [ -d "src/activity" ] && [ -f "src/activity/package.json" ]; then
    log "Installing activity client dependencies..."
    cd src/activity
    npm ci --production=false 2>/dev/null || npm install
    if [ $? -ne 0 ]; then
        log "${RED}Activity client npm install failed${NC}"
        exit 1
    fi
    cd ../..
fi

log "${GREEN}Dependencies installed${NC}"
log ""

# Step 4: Validate required environment variables
log "${YELLOW}Validating environment variables...${NC}"
if [ -f ".env" ]; then
    # Check for required variables
    MISSING_VARS=""

    if ! grep -q "^SESSION_SECRET=." .env; then
        MISSING_VARS="${MISSING_VARS}SESSION_SECRET "
    fi

    if ! grep -q "^FUMBLEBOT_DISCORD_CLIENT_ID=." .env; then
        MISSING_VARS="${MISSING_VARS}FUMBLEBOT_DISCORD_CLIENT_ID "
    fi

    if [ -n "$MISSING_VARS" ]; then
        log "${RED}Missing required environment variables: ${MISSING_VARS}${NC}"
        log "${YELLOW}Please set these in your .env file before deploying.${NC}"
        log "${YELLOW}See .env.example for required variables.${NC}"
        exit 1
    fi

    log "${GREEN}Environment variables validated${NC}"
else
    log "${RED}.env file not found${NC}"
    log "${YELLOW}Please create a .env file from .env.example${NC}"
    exit 1
fi
log ""

# Step 5: Build and setup
log "${YELLOW}Step 5/6: Building application...${NC}"
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

# Step 6: Restart service
log "${YELLOW}Step 6/6: Restarting service...${NC}"
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
