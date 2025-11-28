#!/usr/bin/env tsx
/**
 * Test World Anvil API using Puppeteer to bypass Cloudflare
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Load environment variables
config({ path: resolve(process.cwd(), '.env') });

async function testIdentityWithBrowser() {
  console.log('🌐 Testing World Anvil API with Browser (Puppeteer)\n');

  const applicationKey = process.env.WORLD_ANVIL_CLIENT_SECRET;
  const authToken = process.env.WORLD_ANVIL_TOKEN;

  if (!applicationKey || !authToken) {
    console.error('❌ Missing credentials');
    process.exit(1);
  }

  console.log('✅ Credentials loaded');
  console.log(`   Application Key: ${applicationKey.substring(0, 20)}...`);
  console.log(`   Auth Token: ${authToken.substring(0, 20)}...`);

  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Set headers
    await page.setExtraHTTPHeaders({
      'x-application-key': applicationKey,
      'x-auth-token': authToken,
      'User-Agent': 'Crit-Fumble (https://www.crit-fumble.com, 1.0.0)'
    });

    console.log('\n🔍 Navigating to /api/external/boromir/identity...');

    const url = 'https://www.worldanvil.com/api/external/boromir/identity';

    const response = await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    console.log(`\n📊 Response Status: ${response?.status()}`);

    // Get the page content
    const content = await page.content();

    // Check if it's JSON
    if (content.includes('{') && content.includes('}')) {
      const bodyHandle = await page.$('body');
      const bodyText = await page.evaluate(body => body?.textContent, bodyHandle);

      try {
        const jsonData = JSON.parse(bodyText || '{}');
        console.log('\n✅ Success! Response:');
        console.log(JSON.stringify(jsonData, null, 2));
      } catch (e) {
        console.log('\n📄 Response (not JSON):');
        console.log(bodyText);
      }
    } else {
      console.log('\n⚠️  Response appears to be HTML (possibly Cloudflare):');
      console.log(content.substring(0, 500));
    }

    await browser.close();

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    await browser.close();
    process.exit(1);
  }
}

testIdentityWithBrowser();
