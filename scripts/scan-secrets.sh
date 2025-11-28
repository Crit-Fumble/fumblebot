#!/bin/bash
# Secret Scanner Pre-commit Hook
# Scans staged files for potential secrets before allowing commit

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Scanning for secrets in staged files..."

# Get list of staged files (excluding deleted files)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
    echo -e "${GREEN}✓ No staged files to scan${NC}"
    exit 0
fi

# Patterns to detect secrets
# Format: "pattern|description"
PATTERNS=(
    # API Keys
    'sk-[a-zA-Z0-9]{20,}|OpenAI API Key'
    'sk-ant-[a-zA-Z0-9-]{40,}|Anthropic API Key'
    'xoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}|Slack Bot Token'
    'xoxp-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}|Slack User Token'
    'ghp_[a-zA-Z0-9]{36}|GitHub Personal Access Token'
    'gho_[a-zA-Z0-9]{36}|GitHub OAuth Token'
    'github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}|GitHub Fine-grained PAT'

    # AWS
    'AKIA[0-9A-Z]{16}|AWS Access Key ID'
    '[a-zA-Z0-9/+]{40}|AWS Secret Key (potential)'

    # Database URLs with passwords
    'postgresql://[^:]+:[^@]+@|PostgreSQL Connection String'
    'mysql://[^:]+:[^@]+@|MySQL Connection String'
    'mongodb(\+srv)?://[^:]+:[^@]+@|MongoDB Connection String'

    # Discord
    '[MN][A-Za-z\d]{23,27}\.[A-Za-z\d-_]{6}\.[A-Za-z\d-_]{27,40}|Discord Bot Token'

    # Generic secrets
    'AVNS_[a-zA-Z0-9]{20,}|DigitalOcean Database Password'
    'dop_v1_[a-f0-9]{64}|DigitalOcean API Token'
    'whsec_[a-zA-Z0-9]{32,}|Stripe Webhook Secret'
    'sk_live_[a-zA-Z0-9]{24,}|Stripe Live Secret Key'
    'sk_test_[a-zA-Z0-9]{24,}|Stripe Test Secret Key'
    'pk_live_[a-zA-Z0-9]{24,}|Stripe Live Public Key'
    'pk_test_[a-zA-Z0-9]{24,}|Stripe Test Public Key'

    # Private keys
    '-----BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----|Private Key'
    '-----BEGIN PGP PRIVATE KEY BLOCK-----|PGP Private Key'
)

# Files to always ignore
IGNORE_PATTERNS=(
    '\.env\.example$'
    '\.env\.sample$'
    '\.env\.template$'
    'package-lock\.json$'
    'yarn\.lock$'
    'pnpm-lock\.yaml$'
    '\.md$'  # Markdown files (documentation)
    'scan-secrets\.sh$'  # This script
)

FOUND_SECRETS=0
WARNINGS=()

for FILE in $STAGED_FILES; do
    # Skip ignored files
    SKIP=false
    for IGNORE in "${IGNORE_PATTERNS[@]}"; do
        if echo "$FILE" | grep -qE "$IGNORE"; then
            SKIP=true
            break
        fi
    done

    if [ "$SKIP" = true ]; then
        continue
    fi

    # Check if file exists and is readable
    if [ ! -f "$FILE" ]; then
        continue
    fi

    # Get staged content
    CONTENT=$(git show ":$FILE" 2>/dev/null || cat "$FILE")

    for PATTERN_DESC in "${PATTERNS[@]}"; do
        PATTERN=$(echo "$PATTERN_DESC" | cut -d'|' -f1)
        DESC=$(echo "$PATTERN_DESC" | cut -d'|' -f2)

        # Search for pattern
        MATCHES=$(echo "$CONTENT" | grep -oE "$PATTERN" 2>/dev/null || true)

        if [ -n "$MATCHES" ]; then
            FOUND_SECRETS=1
            echo -e "${RED}❌ POTENTIAL SECRET FOUND${NC}"
            echo -e "   File: ${YELLOW}$FILE${NC}"
            echo -e "   Type: ${YELLOW}$DESC${NC}"
            echo -e "   Pattern matched: $PATTERN"
            echo ""
            WARNINGS+=("$FILE: $DESC")
        fi
    done
done

# Also check for .env files being staged
ENV_FILES=$(echo "$STAGED_FILES" | grep -E '\.env$|\.env\.[a-z]+$' | grep -vE '\.example$|\.sample$|\.template$' || true)
if [ -n "$ENV_FILES" ]; then
    FOUND_SECRETS=1
    echo -e "${RED}❌ ENVIRONMENT FILES STAGED${NC}"
    echo -e "   The following .env files are staged for commit:"
    for ENV_FILE in $ENV_FILES; do
        echo -e "   ${YELLOW}$ENV_FILE${NC}"
    done
    echo ""
    echo -e "   ${YELLOW}These files typically contain secrets and should NOT be committed.${NC}"
    echo -e "   Add them to .gitignore instead."
fi

if [ $FOUND_SECRETS -eq 1 ]; then
    echo ""
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}COMMIT BLOCKED: Potential secrets detected!${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "To fix this:"
    echo "  1. Remove the secrets from the staged files"
    echo "  2. Use environment variables instead"
    echo "  3. Add the file to .gitignore if it should never be committed"
    echo ""
    echo "To bypass this check (NOT RECOMMENDED):"
    echo "  git commit --no-verify"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ No secrets detected in staged files${NC}"
exit 0
