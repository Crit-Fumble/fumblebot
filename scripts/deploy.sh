#!/bin/bash
# FumbleBot Unified Deploy Script
# Builds locally, uploads to production, and restarts service
#
# Usage: npm run deploy
#        FUMBLEBOT_SERVER=user@host FUMBLEBOT_DIR=/path npm run deploy

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration - can be overridden with environment variables
SERVER="${FUMBLEBOT_SERVER:-fumblebot@fumblebot.crit-fumble.com}"
REMOTE_DIR="${FUMBLEBOT_DIR:-/home/fumblebot/app}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}     FumbleBot Deploy${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Server:${NC} $SERVER"
echo -e "${BLUE}Path:${NC}   $REMOTE_DIR"
echo ""

# Step 0: Verify SSH connectivity
echo -e "${YELLOW}Step 0/5: Verifying SSH connectivity...${NC}"
if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$SERVER" "echo 'SSH OK'" 2>/dev/null; then
    echo -e "${RED}Cannot connect to $SERVER${NC}"
    echo -e "${YELLOW}Check your SSH key and server address${NC}"
    echo -e "${YELLOW}You can override with: FUMBLEBOT_SERVER=user@host npm run deploy${NC}"
    exit 1
fi
echo -e "${GREEN}✓ SSH connection verified${NC}"
echo ""

# Step 1: Build locally
echo -e "${YELLOW}Step 1/5: Building locally...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Step 2: Create tarball of dist, prisma, and node_modules (production only)
echo -e "${YELLOW}Step 2/5: Creating deployment package...${NC}"
# Remove old tarball if it exists
rm -f /tmp/fumblebot-dist.tar.gz
# Include node_modules to avoid memory-intensive npm install on small droplets
# Use --exclude to skip devDependencies-only packages and build caches
# Keep 'prisma' package - needed for prisma generate on server

# Show what we're packing
echo -e "  ${BLUE}Packing: dist, prisma, package.json, node_modules${NC}"
echo -e "  ${BLUE}Excluding: .cache, @types, typescript, vitest, husky${NC}"

# Use verbose mode with progress indicator
echo -e "  ${BLUE}Creating tarball (this may take 30-60 seconds)...${NC}"
tar -czf /tmp/fumblebot-dist.tar.gz \
    --exclude='node_modules/.cache' \
    --exclude='node_modules/@types' \
    --exclude='node_modules/typescript' \
    --exclude='node_modules/vitest' \
    --exclude='node_modules/@vitest' \
    --exclude='node_modules/husky' \
    --checkpoint=1000 \
    --checkpoint-action=dot \
    dist prisma package.json package-lock.json node_modules
echo ""  # newline after dots
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to create tarball${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Package created ($(du -h /tmp/fumblebot-dist.tar.gz | cut -f1))${NC}"
echo ""

# Step 3: Upload and extract on server
echo -e "${YELLOW}Step 3/5: Uploading to server...${NC}"
scp /tmp/fumblebot-dist.tar.gz "$SERVER:$REMOTE_DIR/"
if [ $? -ne 0 ]; then
    echo -e "${RED}Upload failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Package uploaded${NC}"
echo ""

# Step 4: Extract and setup on server
echo -e "${YELLOW}Step 4/5: Extracting and setting up...${NC}"
ssh "$SERVER" "cd $REMOTE_DIR && \
    echo 'Verifying uploaded tarball...' && \
    gzip -t fumblebot-dist.tar.gz && \
    echo 'Tarball verified OK' && \
    rm -rf dist prisma node_modules && \
    tar -xzf fumblebot-dist.tar.gz && \
    rm fumblebot-dist.tar.gz && \
    npx prisma generate"
if [ $? -ne 0 ]; then
    echo -e "${RED}Setup failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Code deployed${NC}"
echo ""

# Step 5: Restart service (using systemd via sudo -n for non-interactive)
echo -e "${YELLOW}Step 5/5: Restarting service...${NC}"
ssh "$SERVER" "sudo -n systemctl restart fumblebot && sleep 3"
if [ $? -ne 0 ]; then
    echo -e "${RED}Service restart failed${NC}"
    echo -e "${YELLOW}Note: fumblebot user needs passwordless sudo${NC}"
    echo -e "${YELLOW}Run: ssh root@fumblebot.crit-fumble.com 'echo \"fumblebot ALL=(ALL) NOPASSWD: ALL\" > /etc/sudoers.d/fumblebot'${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Service restarted${NC}"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}     Deployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Verify health
echo ""
echo -e "${BLUE}Health Check:${NC}"
sleep 2
HEALTH=$(ssh "$SERVER" "curl -s http://localhost:3000/health" 2>/dev/null || echo "")
if echo "$HEALTH" | grep -q "ok"; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "$HEALTH"
else
    echo -e "${YELLOW}⚠ Health check inconclusive - service may still be starting${NC}"
    echo "Check logs with: ssh $SERVER 'journalctl -u fumblebot -n 50 -f'"
fi
echo ""
