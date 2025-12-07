#!/bin/bash

# Guild Configuration Migration Deployment Script
#
# Run this on the production server where FumbleBot has database access
#
# Usage:
#   bash scripts/deploy-guild-config-migration.sh [--dry-run]

set -e

DRY_RUN=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
  esac
done

echo "======================================"
echo "Guild Config Migration Deployment"
echo "======================================"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo "MODE: DRY RUN (no changes will be made)"
else
  echo "MODE: LIVE MIGRATION"
fi
echo ""

# Check we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Must run from project root"
  exit 1
fi

# Check database URL is set
if [ -z "$FUMBLEBOT_DATABASE_URL" ]; then
  echo "❌ Error: FUMBLEBOT_DATABASE_URL not set"
  exit 1
fi

echo "✅ Environment check passed"
echo ""

# Step 1: Apply database schema changes
echo "Step 1: Applying database schema..."
if [ "$DRY_RUN" = true ]; then
  echo "  [DRY RUN] Would run: npx tsx scripts/apply-guild-ai-config-migration.ts"
else
  npx tsx scripts/apply-guild-ai-config-migration.ts
fi
echo ""

# Step 2: Regenerate Prisma client
echo "Step 2: Regenerating Prisma client..."
if [ "$DRY_RUN" = true ]; then
  echo "  [DRY RUN] Would run: npx prisma generate"
else
  npx prisma generate
fi
echo ""

# Step 3: Run data migration (dry run first)
echo "Step 3: Migrating guild settings data..."
if [ "$DRY_RUN" = true ]; then
  echo "  Running data migration in dry-run mode..."
  npx tsx scripts/migrate-guild-config.ts --dry-run
else
  echo "  Running data migration (for real)..."
  npx tsx scripts/migrate-guild-config.ts
fi
echo ""

# Step 4: Verify migration
echo "Step 4: Verification..."
if [ "$DRY_RUN" = false ]; then
  echo "Checking GuildAIConfig table..."
  npx tsx -e "
    import { getPrisma } from './src/services/db/client.js';
    const prisma = getPrisma();
    const count = await prisma.guildAIConfig.count();
    console.log(\`✅ Found \${count} AI config records\`);
    await prisma.\$disconnect();
  "
fi
echo ""

echo "======================================"
if [ "$DRY_RUN" = true ]; then
  echo "✅ Dry run complete!"
  echo ""
  echo "To perform the actual migration:"
  echo "  bash scripts/deploy-guild-config-migration.sh"
else
  echo "✅ Migration complete!"
  echo ""
  echo "Next steps:"
  echo "  1. Update code to use new config system"
  echo "  2. Test the new configuration service"
  echo "  3. Monitor for any issues"
fi
echo "======================================"
