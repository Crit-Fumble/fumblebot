#!/bin/bash
# FumbleBot Deploy Script
# Run this locally after merging to main to deploy to production

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DROPLET_HOST="159.203.126.144"
DROPLET_USER="root"
APP_DIR="/root/fumblebot"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}           FumbleBot Deployment Script${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Step 1: Run security scan
echo -e "${YELLOW}Step 1/5: Running security scan...${NC}"
bash scripts/scan-secrets.sh
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Security scan failed - aborting deployment${NC}"
    exit 1
fi
echo ""

# Step 2: Build locally to catch errors
echo -e "${YELLOW}Step 2/5: Building locally...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed - aborting deployment${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build successful${NC}"
echo ""

# Step 3: Run tests
echo -e "${YELLOW}Step 3/5: Running tests...${NC}"
npm run test:unit
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Tests failed - aborting deployment${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Tests passed${NC}"
echo ""

# Step 4: Deploy to droplet
echo -e "${YELLOW}Step 4/5: Deploying to production...${NC}"
ssh ${DROPLET_USER}@${DROPLET_HOST} << 'ENDSSH'
    set -e
    cd /root/fumblebot

    echo "📦 Pulling latest code..."
    git fetch origin main
    git reset --hard origin/main

    echo "📥 Installing dependencies..."
    npm ci --production=false

    echo "🔧 Generating Prisma client..."
    npx prisma generate --schema=prisma/schema.prisma

    echo "🔨 Building..."
    npm run build

    echo "🗄️ Running database migrations..."
    npx prisma migrate deploy --schema=prisma/schema.prisma || true

    echo "🔄 Restarting service..."
    systemctl restart fumblebot

    echo "⏳ Waiting for service to start..."
    sleep 3
ENDSSH

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Deployed to droplet${NC}"
echo ""

# Step 5: Health check
echo -e "${YELLOW}Step 5/5: Running health check...${NC}"
sleep 5
ssh ${DROPLET_USER}@${DROPLET_HOST} << 'ENDSSH'
    if systemctl is-active --quiet fumblebot; then
        echo "✅ FumbleBot service is running"
        systemctl status fumblebot --no-pager | head -10
    else
        echo "❌ FumbleBot service is not running"
        journalctl -u fumblebot -n 20 --no-pager
        exit 1
    fi
ENDSSH

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}       🎉 Deployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
