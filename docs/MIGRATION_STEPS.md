# Guild Configuration Migration - Deployment Steps

## Prerequisites

- SSH access to production server
- Database access (FUMBLEBOT_DATABASE_URL configured)
- Core server running with Admin API enabled

## Quick Start (On Production Server)

```bash
# SSH to server
ssh fumblebot@your-server.com

# Navigate to project
cd /path/to/fumblebot

# Pull latest changes
git pull origin main

# Install dependencies (if needed)
npm install

# Run migration (dry-run first!)
bash scripts/deploy-guild-config-migration.sh --dry-run

# If dry-run looks good, run for real
bash scripts/deploy-guild-config-migration.sh
```

## Manual Step-by-Step

### Step 1: Apply Database Schema

This creates the `GuildAIConfig` table:

```bash
npx tsx scripts/apply-guild-ai-config-migration.ts
```

**Expected output:**
```
🔄 Applying GuildAIConfig migration...
✅ Migration applied successfully!
Table verification: [ { table_name: 'GuildAIConfig' } ]
```

### Step 2: Regenerate Prisma Client

```bash
npx prisma generate
```

### Step 3: Migrate Guild Settings Data

First, do a dry-run to see what will be migrated:

```bash
npx tsx scripts/migrate-guild-config.ts --dry-run
```

**Example dry-run output:**
```
🔄 Guild Configuration Migration
================================
Mode: DRY RUN (no changes will be made)
Target: all guilds

Found 5 guild(s) to migrate

[123456789] My Guild: Migrating guild settings...
  [DRY RUN] Would migrate to Core: { prefix: '!', aiAssistant: true, ... }
  [DRY RUN] Would migrate to GuildAIConfig: { primaryModel: 'claude-sonnet-4-20250514', ... }

================================
Migration Summary
  Total guilds: 5
  Migrated: 5
  Skipped: 0
  Failed: 0

⚠️  This was a DRY RUN - no changes were made
Run without --dry-run to perform the actual migration
```

If everything looks good, run the actual migration:

```bash
npx tsx scripts/migrate-guild-config.ts
```

### Step 4: Verify Migration

Check that settings migrated to Core:

```bash
curl -H "X-Core-Secret: $CORE_SECRET" \
  http://core.internal:4000/api/admin/guilds/YOUR_GUILD_ID/config
```

Check that AI settings are in FumbleBot database:

```bash
npx tsx -e "
  import { getPrisma } from './src/services/db/client.js';
  const prisma = getPrisma();
  const configs = await prisma.guildAIConfig.findMany();
  console.log(configs);
  await prisma.\$disconnect();
"
```

### Step 5: Test the New Config System

```bash
npx tsx -e "
  import { getGuildConfig } from './src/services/config/guild-config.js';
  const config = await getGuildConfig('YOUR_GUILD_ID');
  console.log('General config:', config.general);
  console.log('AI config:', config.ai);
"
```

## Migrate Specific Guild

To migrate just one guild (useful for testing):

```bash
# Dry run for specific guild
npx tsx scripts/migrate-guild-config.ts --dry-run --guild 123456789

# Actually migrate
npx tsx scripts/migrate-guild-config.ts --guild 123456789
```

## Rollback Plan

If something goes wrong, the old `Guild.settings` field is still there (deprecated but functional).

To revert:

1. **Don't delete the `Guild.settings` field yet**
2. Code can fall back to old system temporarily
3. Fix the issue
4. Re-run migration

## Troubleshooting

### Database Connection Timeout

```
Error: Operation has timed out
```

**Solution:** Run the migration from a server that has database access (production server, not local machine).

### Core API Not Responding

```
Error: Failed to fetch general config from Core
```

**Solution:** The config service automatically falls back to defaults. Core settings will be synced when Core is back online.

### Prisma Client Not Updated

```
Error: Property 'guildAIConfig' does not exist
```

**Solution:** Run `npx prisma generate` to regenerate the Prisma client.

## Post-Migration Checklist

- [ ] Database schema applied successfully
- [ ] Guild settings migrated to Core
- [ ] AI settings migrated to GuildAIConfig table
- [ ] Verified settings via Core API
- [ ] Verified AI settings in database
- [ ] Tested config service
- [ ] Restarted FumbleBot service
- [ ] Monitored logs for errors
- [ ] Updated any code using old `Guild.settings` (future task)

## Files Changed

- `prisma/schema.prisma` - Added GuildAIConfig model
- `src/services/config/guild-config.ts` - New config service (NEW)
- `scripts/migrate-guild-config.ts` - Migration script (NEW)
- `scripts/apply-guild-ai-config-migration.ts` - SQL migration (NEW)
- `scripts/deploy-guild-config-migration.sh` - Deployment script (NEW)

## Next Steps After Migration

1. Update code to use new config system:
   ```typescript
   // Old way
   const guild = await prisma.guild.findUnique({ where: { guildId } })
   const prefix = guild.settings.prefix || '!'

   // New way
   const prefix = await getGuildPrefix(guildId)
   ```

2. Gradually phase out `Guild.settings` field

3. Remove deprecated field in future migration (after all code updated)

## Support

For issues:
- Check logs: `pm2 logs fumblebot`
- Review migration doc: [GUILD_CONFIG_MIGRATION.md](./GUILD_CONFIG_MIGRATION.md)
- Test locally first with `--dry-run`
