#!/usr/bin/env tsx
/**
 * Test script to verify World Anvil API credentials
 * Tests the /identity endpoint
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import axios from 'axios';

// Load environment variables from .env
config({ path: resolve(process.cwd(), '.env') });

async function testIdentity() {
  console.log('🔐 Testing World Anvil API Identity Endpoint\n');

  const applicationKey = process.env.WORLD_ANVIL_CLIENT_SECRET;
  const authToken = process.env.WORLD_ANVIL_TOKEN;

  if (!applicationKey || !authToken) {
    console.error('❌ Missing credentials:');
    if (!applicationKey) console.error('   - WORLD_ANVIL_CLIENT_SECRET');
    if (!authToken) console.error('   - WORLD_ANVIL_TOKEN');
    process.exit(1);
  }

  console.log('✅ Credentials loaded');
  console.log(`   Application Key: ${applicationKey.substring(0, 20)}...`);
  console.log(`   Auth Token: ${authToken.substring(0, 20)}...`);

  try {
    console.log('\n🔍 Calling GET /api/external/boromir/identity');
    console.log('   Using header-based authentication');

    const url = `https://www.worldanvil.com/api/external/boromir/identity`;

    const response = await axios.get(url, {
      headers: {
        'x-application-key': applicationKey,
        'x-auth-token': authToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.worldanvil.com/',
        'Origin': 'https://www.worldanvil.com',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
      }
    });

    console.log('\n✅ Success! Response:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error: any) {
    console.error('\n❌ Error:');
    console.error(`   Status: ${error.response?.status || 'N/A'}`);
    console.error(`   Message: ${error.message}`);

    if (error.response?.data) {
      console.error('\n   Response data:');
      if (typeof error.response.data === 'string') {
        // Check if it's HTML (Cloudflare page)
        if (error.response.data.includes('<!DOCTYPE html>')) {
          console.error('   Received HTML response (likely Cloudflare challenge)');
          console.error('   First 500 chars:', error.response.data.substring(0, 500));
        } else {
          console.error('   ', error.response.data);
        }
      } else {
        console.error('   ', JSON.stringify(error.response.data, null, 2));
      }
    }

    process.exit(1);
  }
}

testIdentity();
