#!/bin/bash
# Secret Scanner Pre-commit Hook
# Fast scan of staged files for potential secrets

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 Scanning for secrets in staged files..."

# Get staged files only (not deleted)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || echo "")

if [ -z "$STAGED_FILES" ]; then
    echo -e "${GREEN}✓ No staged files to scan${NC}"
    exit 0
fi

# Count files
FILE_COUNT=$(echo "$STAGED_FILES" | wc -l)
echo "   Checking $FILE_COUNT file(s)..."

FOUND_SECRETS=0

# Check for .env files being staged (fast check first)
ENV_FILES=$(echo "$STAGED_FILES" | grep -E '^\.env$|^\.env\.[^.]+$' | grep -vE '\.example$|\.sample$|\.template$' || true)
if [ -n "$ENV_FILES" ]; then
    FOUND_SECRETS=1
    echo -e "${RED}❌ .env file(s) staged for commit:${NC}"
    echo "$ENV_FILES" | while read f; do echo -e "   ${YELLOW}$f${NC}"; done
fi

# Use grep to scan all staged files at once (much faster than loop)
# Get the staged content and search with grep
for FILE in $STAGED_FILES; do
    # Skip certain file types
    case "$FILE" in
        *.md|*.lock|package-lock.json|yarn.lock|*.example|*.sample|scan-secrets.sh|deploy.yml)
            continue
            ;;
    esac

    # Skip if file doesn't exist (deleted)
    [ -f "$FILE" ] || continue

    # Skip binary files (check for null bytes)
    if file "$FILE" 2>/dev/null | grep -q "binary\|executable\|image\|audio\|video"; then
        continue
    fi

    # Get staged content, skip if binary (contains null bytes)
    CONTENT=$(git show ":$FILE" 2>/dev/null | tr -d '\0') || continue

    # Skip empty content
    [ -z "$CONTENT" ] && continue

    # OpenAI key
    if echo "$CONTENT" | grep -qE 'sk-[a-zA-Z0-9]{20,}'; then
        echo -e "${RED}❌ Potential OpenAI API key in: ${YELLOW}$FILE${NC}"
        FOUND_SECRETS=1
    fi

    # Anthropic key
    if echo "$CONTENT" | grep -qE 'sk-ant-[a-zA-Z0-9-]{40,}'; then
        echo -e "${RED}❌ Potential Anthropic API key in: ${YELLOW}$FILE${NC}"
        FOUND_SECRETS=1
    fi

    # DigitalOcean database password
    if echo "$CONTENT" | grep -qE 'AVNS_[a-zA-Z0-9]{10,}'; then
        echo -e "${RED}❌ Potential DO database password in: ${YELLOW}$FILE${NC}"
        FOUND_SECRETS=1
    fi

    # DigitalOcean API token
    if echo "$CONTENT" | grep -qE 'dop_v1_[a-f0-9]{64}'; then
        echo -e "${RED}❌ Potential DO API token in: ${YELLOW}$FILE${NC}"
        FOUND_SECRETS=1
    fi

    # Database URLs with passwords
    if echo "$CONTENT" | grep -qE 'postgresql://[^:]+:[^@]{8,}@'; then
        echo -e "${RED}❌ Potential database URL with password in: ${YELLOW}$FILE${NC}"
        FOUND_SECRETS=1
    fi

    # Discord bot token
    if echo "$CONTENT" | grep -qE '[MN][A-Za-z0-9]{23,27}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}'; then
        echo -e "${RED}❌ Potential Discord bot token in: ${YELLOW}$FILE${NC}"
        FOUND_SECRETS=1
    fi

    # Stripe keys
    if echo "$CONTENT" | grep -qE 'sk_(live|test)_[a-zA-Z0-9]{24,}'; then
        echo -e "${RED}❌ Potential Stripe secret key in: ${YELLOW}$FILE${NC}"
        FOUND_SECRETS=1
    fi

    # Stripe webhook secrets
    if echo "$CONTENT" | grep -qE 'whsec_[a-zA-Z0-9]{24,}'; then
        echo -e "${RED}❌ Potential Stripe webhook secret in: ${YELLOW}$FILE${NC}"
        FOUND_SECRETS=1
    fi

    # AWS keys
    if echo "$CONTENT" | grep -qE 'AKIA[0-9A-Z]{16}'; then
        echo -e "${RED}❌ Potential AWS access key in: ${YELLOW}$FILE${NC}"
        FOUND_SECRETS=1
    fi

    # Private keys (simplified pattern to avoid shell escaping issues)
    if echo "$CONTENT" | grep -q "BEGIN.*PRIVATE KEY"; then
        echo -e "${RED}❌ Private key found in: ${YELLOW}$FILE${NC}"
        FOUND_SECRETS=1
    fi
done

if [ $FOUND_SECRETS -eq 1 ]; then
    echo ""
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}COMMIT BLOCKED: Potential secrets detected!${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "To fix: Remove secrets and use environment variables instead."
    echo "To bypass (NOT RECOMMENDED): git commit --no-verify"
    exit 1
fi

echo -e "${GREEN}✓ No secrets detected${NC}"
exit 0
