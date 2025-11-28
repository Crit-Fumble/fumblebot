#!/bin/bash
# Push to main and automatically deploy
# Use this instead of 'git push' for automatic deployment

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}     FumbleBot Push & Deploy${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Push to origin (Husky pre-push will run security scan)
echo -e "${YELLOW}Pushing to origin/${BRANCH}...${NC}"
git push "$@"

if [ $? -ne 0 ]; then
    echo -e "${RED}Push failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Push successful${NC}"
echo ""

# Deploy if pushing to main
if [[ "$BRANCH" == "main" ]]; then
    echo -e "${YELLOW}Deploying to production...${NC}"

    # Check if server is reachable
    if ssh -o ConnectTimeout=5 -o BatchMode=yes root@159.203.126.144 'exit' 2>/dev/null; then
        npm run deploy:git
    else
        echo -e "${RED}Could not connect to server${NC}"
        echo "Run 'npm run deploy:git' manually when ready"
        exit 1
    fi
else
    echo -e "${YELLOW}Not on main branch - skipping deployment${NC}"
fi
