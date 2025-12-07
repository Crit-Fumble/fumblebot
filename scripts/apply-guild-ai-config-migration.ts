/**
 * Apply GuildAIConfig migration directly via SQL
 */

import { getPrisma } from '../src/services/db/client.js'

const migrationSql = `
-- Create GuildAIConfig table
CREATE TABLE IF NOT EXISTS "GuildAIConfig" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "primaryModel" TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    "lookupModel" TEXT NOT NULL DEFAULT 'claude-haiku-4-20250514',
    "thinkingModel" TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 2000,
    "enableThinking" BOOLEAN NOT NULL DEFAULT true,
    "enableLookup" BOOLEAN NOT NULL DEFAULT true,
    "enableContext" BOOLEAN NOT NULL DEFAULT true,
    "enableMemory" BOOLEAN NOT NULL DEFAULT true,
    "maxContextMessages" INTEGER NOT NULL DEFAULT 20,
    "contextWindowHours" INTEGER NOT NULL DEFAULT 24,
    "customSettings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildAIConfig_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on guildId
CREATE UNIQUE INDEX IF NOT EXISTS "GuildAIConfig_guildId_key" ON "GuildAIConfig"("guildId");

-- Create index on guildId
CREATE INDEX IF NOT EXISTS "GuildAIConfig_guildId_idx" ON "GuildAIConfig"("guildId");

-- Add foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'GuildAIConfig_guildId_fkey'
    ) THEN
        ALTER TABLE "GuildAIConfig"
        ADD CONSTRAINT "GuildAIConfig_guildId_fkey"
        FOREIGN KEY ("guildId")
        REFERENCES "Guild"("guildId")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    END IF;
END $$;
`

async function main() {
  console.log('🔄 Applying GuildAIConfig migration...')

  const prisma = getPrisma()

  try {
    // Execute the migration SQL
    await prisma.$executeRawUnsafe(migrationSql)

    console.log('✅ Migration applied successfully!')

    // Verify the table exists
    const result = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'GuildAIConfig'
    `

    console.log('Table verification:', result)

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
