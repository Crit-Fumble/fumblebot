#!/usr/bin/env tsx
/**
 * CLI Tool: Fetch RPG Systems from World Anvil
 *
 * Usage:
 *   tsx cli/fetch-rpg-systems.ts [options]
 *
 * Options:
 *   --output, -o <path>    Output JSON file path (default: data/_sources/worldanvil/rpg-systems.json)
 *   --format, -f <format>  Output format: json or typescript (default: json)
 *   --systems <list>       Comma-separated list of system slugs to fetch (e.g., "5e,cypher-system")
 *   --cache                Use cached data if available (skip API call)
 *
 * Environment Variables:
 *   WORLDANVIL_API_KEY     Required: Your World Anvil API key
 *   WORLDANVIL_ACCESS_TOKEN Optional: OAuth access token for authenticated requests
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { WorldAnvilApiClient } from '../client/WorldAnvilApiClient.js';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { dirname } from 'path';

// Load environment variables from .env
config({ path: resolve(process.cwd(), '.env') });

interface CLIOptions {
  output: string;
  format: 'json' | 'typescript';
  systems?: string[];
  cache: boolean;
}

// Parse command line arguments
function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    output: 'src/packages/worldanvil/data/rpg-systems.json',
    format: 'json',
    cache: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--format':
      case '-f':
        options.format = args[++i] as 'json' | 'typescript';
        break;
      case '--systems':
        options.systems = args[++i].split(',').map(s => s.trim());
        break;
      case '--cache':
        options.cache = true;
        break;
      case '--help':
      case '-h':
        console.log(`
World Anvil RPG Systems Fetcher

Usage:
  tsx cli/fetch-rpg-systems.ts [options]

Options:
  --output, -o <path>    Output JSON file path (default: data/_sources/worldanvil/rpg-systems.json)
  --format, -f <format>  Output format: json or typescript (default: json)
  --systems <list>       Comma-separated list of system slugs to fetch (e.g., "5e,cypher-system")
  --cache                Use cached data if available (skip API call)
  --help, -h             Show this help message

Environment Variables:
  WORLDANVIL_API_KEY     Required: Your World Anvil API key
  WORLDANVIL_ACCESS_TOKEN Optional: OAuth access token

Examples:
  # Fetch all RPG systems
  tsx cli/fetch-rpg-systems.ts

  # Fetch only D&D 5e and Cypher System
  tsx cli/fetch-rpg-systems.ts --systems "5e,cypher-system"

  # Use cached data if available
  tsx cli/fetch-rpg-systems.ts --cache

  # Output as TypeScript file
  tsx cli/fetch-rpg-systems.ts --format typescript --output src/data/rpg-systems.ts
`);
        process.exit(0);
    }
  }

  return options;
}

// Rate limiter
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const options = parseArgs();

  console.log('🌍 World Anvil RPG Systems Fetcher\n');

  // Check for API keys
  const applicationKey = process.env.WORLD_ANVIL_CLIENT_SECRET;
  const authToken = process.env.WORLD_ANVIL_TOKEN;

  if (!applicationKey || !authToken) {
    console.error('❌ Error: World Anvil API credentials required');
    if (!applicationKey) {
      console.error('   Missing: WORLD_ANVIL_CLIENT_SECRET (x-application-key)');
    }
    if (!authToken) {
      console.error('   Missing: WORLD_ANVIL_TOKEN (x-auth-token)');
    }
    console.error('   Set them in your .env file');
    process.exit(1);
  }

  // Check cache if requested
  if (options.cache && existsSync(options.output)) {
    console.log(`📦 Using cached data from ${options.output}`);
    const cached = JSON.parse(readFileSync(options.output, 'utf-8'));
    console.log(`✅ Loaded ${cached.length} systems from cache`);
    return;
  }

  // Initialize API client
  const client = new WorldAnvilApiClient({
    apiKey: applicationKey,
    accessToken: authToken,
    apiUrl: 'https://www.worldanvil.com/api/external/boromir'
  });

  console.log('🔍 Fetching RPG systems from World Anvil API...');
  console.log('📝 Using query parameters for authentication (Cloudflare compatibility)');

  try {
    // Fetch all RPG systems using POST with query params for auth (bypasses Cloudflare)
    const url = `/rpgsystems?x-application-key=${applicationKey}&x-auth-token=${authToken}`;
    const response = await client.post<any>(url, {});

    if (!response || !response.entities) {
      console.error('❌ Error: No RPG systems data received from API');
      process.exit(1);
    }

    let systems = response.entities;
    console.log(`✅ Fetched ${systems.length} RPG systems`);

    // Filter by specified systems if provided
    if (options.systems && options.systems.length > 0) {
      const filteredSystems = systems.filter((system: any) =>
        options.systems!.includes(system.slug)
      );

      console.log(`🔍 Filtered to ${filteredSystems.length} specified systems: ${options.systems.join(', ')}`);

      if (filteredSystems.length === 0) {
        console.warn('⚠️  Warning: No systems matched the specified slugs');
        console.log('Available system slugs:');
        systems.forEach((system: any) => {
          console.log(`  - ${system.slug} (${system.name})`);
        });
      }

      systems = filteredSystems;
    }

    // Add metadata
    const output = {
      metadata: {
        fetched_at: new Date().toISOString(),
        source: 'World Anvil Boromir API',
        api_version: '2.0',
        total_systems: systems.length
      },
      systems
    };

    // Ensure output directory exists
    const outputDir = dirname(options.output);
    if (!existsSync(outputDir)) {
      console.log(`📁 Creating output directory: ${outputDir}`);
      mkdirSync(outputDir, { recursive: true });
    }

    // Write output file
    if (options.format === 'typescript') {
      const tsContent = `/**
 * World Anvil RPG Systems
 * Auto-generated on ${new Date().toISOString()}
 * Source: World Anvil Boromir API v2.0
 */

export interface WorldAnvilRpgSystem {
  id: number;
  name: string;
  slug: string;
  description?: string;
  publisher?: string;
  official: boolean;
  community_created?: boolean;
  icon_url?: string;
  image_url?: string;
}

export const WORLDANVIL_RPG_SYSTEMS: WorldAnvilRpgSystem[] = ${JSON.stringify(systems, null, 2)};

export const WORLDANVIL_RPG_SYSTEMS_BY_SLUG: Record<string, WorldAnvilRpgSystem> = {
${systems.map((s: any) => `  "${s.slug}": WORLDANVIL_RPG_SYSTEMS.find(sys => sys.slug === "${s.slug}")!`).join(',\n')}
};

export const WORLDANVIL_RPG_SYSTEMS_BY_ID: Record<number, WorldAnvilRpgSystem> = {
${systems.map((s: any) => `  ${s.id}: WORLDANVIL_RPG_SYSTEMS.find(sys => sys.id === ${s.id})!`).join(',\n')}
};
`;
      writeFileSync(options.output, tsContent, 'utf-8');
      console.log(`✅ Saved ${systems.length} systems to ${options.output} (TypeScript)`);
    } else {
      writeFileSync(options.output, JSON.stringify(output, null, 2), 'utf-8');
      console.log(`✅ Saved ${systems.length} systems to ${options.output} (JSON)`);
    }

    // Print summary
    console.log('\n📊 Summary:');
    console.log(`   Total systems: ${systems.length}`);

    const official = systems.filter((s: any) => s.official).length;
    const community = systems.filter((s: any) => s.community_created).length;
    console.log(`   Official: ${official}`);
    console.log(`   Community: ${community}`);

    // Show D&D 5e and Cypher System details if available
    const dnd5e = systems.find((s: any) => s.slug === '5e' || s.slug === 'dnd5e');
    const cypher = systems.find((s: any) => s.slug === 'cypher-system');

    if (dnd5e) {
      console.log(`\n🎲 D&D 5e System:`);
      console.log(`   ID: ${dnd5e.id}`);
      console.log(`   Name: ${dnd5e.name}`);
      console.log(`   Slug: ${dnd5e.slug}`);
      console.log(`   Official: ${dnd5e.official ? 'Yes' : 'No'}`);
    }

    if (cypher) {
      console.log(`\n🎲 Cypher System:`);
      console.log(`   ID: ${cypher.id}`);
      console.log(`   Name: ${cypher.name}`);
      console.log(`   Slug: ${cypher.slug}`);
      console.log(`   Official: ${cypher.official ? 'Yes' : 'No'}`);
    }

    console.log('\n✨ Done!');

  } catch (error: any) {
    console.error('\n❌ Error fetching RPG systems:');
    console.error(`   ${error.message}`);

    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }

    process.exit(1);
  }
}

main();
