#!/usr/bin/env tsx
/**
 * Fetch RPG Systems using Puppeteer to bypass Cloudflare
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());
config({ path: resolve(process.cwd(), '.env') });

async function fetchRpgSystemsWithBrowser() {
  console.log('🌐 Fetching RPG Systems with Browser (Puppeteer)\n');

  const applicationKey = process.env.WORLD_ANVIL_CLIENT_SECRET;
  const authToken = process.env.WORLD_ANVIL_TOKEN;

  if (!applicationKey || !authToken) {
    console.error('❌ Missing credentials');
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
      'x-application-key': applicationKey,
      'x-auth-token': authToken,
      'User-Agent': 'Crit-Fumble (https://www.crit-fumble.com, 1.0.0)'
    });

    console.log('🔍 Fetching RPG systems from World Anvil API...');

    // The API spec shows it's a POST endpoint
    const url = 'https://www.worldanvil.com/api/external/boromir/rpgsystems';

    // For POST requests with Puppeteer, we need to use page.evaluate with fetch
    const response = await page.evaluate(async (url, appKey, token) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-application-key': appKey,
          'x-auth-token': token,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({})
      });

      return {
        status: res.status,
        data: await res.json()
      };
    }, url, applicationKey, authToken);

    console.log(`📊 Response Status: ${response.status}\n`);

    if (response.data && response.data.entities) {
      const systems = response.data.entities;
      console.log(`✅ Fetched ${systems.length} RPG systems`);

      // Save to file
      const outputPath = 'src/packages/worldanvil/data/rpg-systems.json';
      const outputDir = dirname(outputPath);

      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      const output = {
        metadata: {
          fetched_at: new Date().toISOString(),
          source: 'World Anvil Boromir API',
          api_version: '2.0',
          total_systems: systems.length
        },
        systems
      };

      writeFileSync(outputPath, JSON.stringify(output, null, 2));
      console.log(`💾 Saved to ${outputPath}`);

      // Show some systems
      console.log('\n📋 Sample systems:');
      systems.slice(0, 5).forEach((sys: any) => {
        console.log(`   - ${sys.name} (${sys.slug})`);
      });
    } else {
      console.error('❌ No RPG systems data received');
      console.log('Response:', JSON.stringify(response.data, null, 2));
    }

    await browser.close();

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    await browser.close();
    process.exit(1);
  }
}

fetchRpgSystemsWithBrowser();
