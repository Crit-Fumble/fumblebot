#!/bin/bash
# FumbleBot Deploy Script
# Run this locally after merging to main to deploy to production
# Uses SCP to sync built files to production droplet

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
echo -e "${YELLOW}Step 1/6: Running security scan...${NC}"
bash scripts/scan-secrets.sh
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Security scan failed - aborting deployment${NC}"
    exit 1
fi
echo ""

# Step 2: Build locally to catch errors
echo -e "${YELLOW}Step 2/6: Building locally...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed - aborting deployment${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build successful${NC}"
echo ""

# Step 3: Run tests
echo -e "${YELLOW}Step 3/6: Running tests...${NC}"
npm run test:unit
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Tests failed - aborting deployment${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Tests passed${NC}"
echo ""

# Step 4: Sync files to droplet
echo -e "${YELLOW}Step 4/6: Syncing files to production...${NC}"
echo "📦 Uploading dist, prisma, package.json, package-lock.json..."
scp -r dist prisma package.json package-lock.json ${DROPLET_USER}@${DROPLET_HOST}:${APP_DIR}/
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ File sync failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Files synced${NC}"
echo ""

# Step 5: Install dependencies and restart
echo -e "${YELLOW}Step 5/6: Installing dependencies and restarting...${NC}"
ssh ${DROPLET_USER}@${DROPLET_HOST} << 'ENDSSH'
    set -e
    cd /root/fumblebot

    echo "📥 Installing dependencies..."
    npm ci --production=false 2>/dev/null || npm install

    echo "🔧 Generating Prisma client..."
    npx prisma generate --schema=prisma/schema.prisma

    echo "🔗 Creating node_modules symlink for dist..."
    ln -sf ../node_modules dist/node_modules 2>/dev/null || true

    echo "🔄 Restarting service..."
    systemctl restart fumblebot

    echo "⏳ Waiting for service to start..."
    sleep 5
ENDSSH

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Deployed to droplet${NC}"
echo ""

# Step 6: Health check
echo -e "${YELLOW}Step 6/6: Running health check...${NC}"
ssh ${DROPLET_USER}@${DROPLET_HOST} << 'ENDSSH'
    if systemctl is-active --quiet fumblebot; then
        echo "✅ FumbleBot service is running"
        systemctl status fumblebot --no-pager | head -10
        echo ""
        # Check health endpoint
        HEALTH=$(curl -s http://localhost:3000/health 2>/dev/null || echo "")
        if echo "$HEALTH" | grep -q '"status":"ok"'; then
            echo "✅ Health check passed"
        else
            echo "⚠️ Health endpoint not responding (service may still be starting)"
        fi
    else
        echo "❌ FumbleBot service is not running"
        tail -50 /root/fumblebot/fumblebot.log
        exit 1
    fi
ENDSSH

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}       🎉 Deployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
