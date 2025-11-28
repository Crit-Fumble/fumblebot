#!/bin/bash
# One-time setup script to configure Git-based deployment on the droplet
# Run this LOCALLY - it will SSH to the server and set things up

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DROPLET_HOST="159.203.126.144"
DROPLET_USER="root"
APP_DIR="/root/fumblebot"
REPO_URL="git@github.com:crit-fumble/fumblebot.git"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}     FumbleBot Server Git Setup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Repo URL from package.json

echo -e "${YELLOW}This script will:${NC}"
echo "  1. Generate SSH key on the server (if needed)"
echo "  2. Clone/initialize the repo with Git"
echo "  3. Install the server-deploy.sh script"
echo "  4. Set up deploy command alias"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 1: Checking/generating SSH key on server...${NC}"
ssh ${DROPLET_USER}@${DROPLET_HOST} << 'ENDSSH'
    if [ ! -f ~/.ssh/id_ed25519 ]; then
        echo "Generating new SSH key..."
        ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N "" -C "fumblebot-server"
    fi
    echo ""
    echo "=== Add this deploy key to your GitHub repo ==="
    echo "Go to: GitHub Repo -> Settings -> Deploy Keys -> Add deploy key"
    echo ""
    cat ~/.ssh/id_ed25519.pub
    echo ""
    echo "================================================"
ENDSSH

echo ""
echo -e "${YELLOW}After adding the deploy key to GitHub, press Enter to continue...${NC}"
read

echo ""
echo -e "${YELLOW}Step 2: Setting up Git repo on server...${NC}"
ssh ${DROPLET_USER}@${DROPLET_HOST} << ENDSSH
    set -e
    cd /root

    # Add GitHub to known hosts
    ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null

    # Backup existing .env if present
    if [ -f ${APP_DIR}/.env ]; then
        echo "Backing up .env file..."
        cp ${APP_DIR}/.env /root/.env.fumblebot.backup
    fi

    # Remove old directory and clone fresh (or init existing)
    if [ -d ${APP_DIR}/.git ]; then
        echo "Git repo already initialized"
        cd ${APP_DIR}
        git remote set-url origin ${REPO_URL} || git remote add origin ${REPO_URL}
    else
        echo "Cloning repository..."
        rm -rf ${APP_DIR}
        git clone ${REPO_URL} ${APP_DIR}
    fi

    cd ${APP_DIR}

    # Restore .env if we backed it up
    if [ -f /root/.env.fumblebot.backup ]; then
        echo "Restoring .env file..."
        cp /root/.env.fumblebot.backup ${APP_DIR}/.env
    fi

    # Make deploy script executable
    chmod +x scripts/server-deploy.sh

    echo "Git setup complete!"
ENDSSH

echo ""
echo -e "${YELLOW}Step 3: Running initial deployment...${NC}"
ssh ${DROPLET_USER}@${DROPLET_HOST} << 'ENDSSH'
    cd /root/fumblebot
    bash scripts/server-deploy.sh
ENDSSH

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}     Server Git Setup Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}To deploy in the future, you can:${NC}"
echo ""
echo "  Option 1 - Simple SSH deploy:"
echo "    npm run deploy:git"
echo ""
echo "  Option 2 - Manual SSH:"
echo "    ssh root@${DROPLET_HOST} 'cd /root/fumblebot && bash scripts/server-deploy.sh'"
echo ""
