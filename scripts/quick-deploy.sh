#!/bin/bash
# FumbleBot Quick Deploy Script
# Builds locally and syncs dist + deps to production
# Much faster than full git-based deploy

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVER="root@fumblebot.crit-fumble.com"
REMOTE_DIR="/root/fumblebot"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}     FumbleBot Quick Deploy${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Step 1: Build locally
echo -e "${YELLOW}Step 1/4: Building locally...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Step 2: Create tarball of dist
echo -e "${YELLOW}Step 2/4: Creating deployment package...${NC}"
tar -czf /tmp/fumblebot-dist.tar.gz dist prisma
echo -e "${GREEN}✓ Package created${NC}"
echo ""

# Step 3: Upload and extract on server
echo -e "${YELLOW}Step 3/4: Uploading to server...${NC}"
scp /tmp/fumblebot-dist.tar.gz $SERVER:$REMOTE_DIR/
ssh $SERVER "cd $REMOTE_DIR && rm -rf dist && tar -xzf fumblebot-dist.tar.gz && rm fumblebot-dist.tar.gz && npx prisma generate"
if [ $? -ne 0 ]; then
    echo -e "${RED}Upload/extract failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Code deployed${NC}"
echo ""

# Step 4: Restart PM2
echo -e "${YELLOW}Step 4/4: Restarting service...${NC}"
ssh $SERVER "fuser -k 3000/tcp 2>/dev/null; cd $REMOTE_DIR && pm2 delete fumblebot 2>/dev/null; pm2 start dist/server.js --name fumblebot && sleep 3 && curl -s http://localhost:3000/health"
if [ $? -ne 0 ]; then
    echo -e "${RED}Service restart failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}     Deployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Verify health
echo ""
echo -e "${BLUE}Health Check:${NC}"
curl -s https://fumblebot.crit-fumble.com/api/ai/health | head -c 200
echo ""
