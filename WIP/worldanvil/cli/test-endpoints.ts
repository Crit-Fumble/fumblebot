#!/usr/bin/env tsx
/**
 * Test multiple World Anvil API endpoints to see which bypass Cloudflare
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import axios from 'axios';

config({ path: resolve(process.cwd(), '.env') });

const applicationKey = process.env.WORLD_ANVIL_CLIENT_SECRET!;
const authToken = process.env.WORLD_ANVIL_TOKEN!;

const endpoints = [
  { method: 'GET', path: '/identity', description: 'User identity' },
  { method: 'GET', path: '/user', description: 'User profile' },
  { method: 'POST', path: '/user/worlds', description: 'User worlds list' },
  { method: 'GET', path: '/world/{id}', description: 'Specific world (needs ID)', skip: true },
  { method: 'POST', path: '/rpgsystems', description: 'RPG systems list' },
  { method: 'GET', path: '/rpgsystem/{id}', description: 'Specific RPG system (needs ID)', skip: true },
];

async function testEndpoint(method: string, path: string, description: string) {
  const url = `https://www.worldanvil.com/api/external/boromir${path}`;

  const config = {
    headers: {
      'x-application-key': applicationKey,
      'x-auth-token': authToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Crit-Fumble (https://www.crit-fumble.com, 1.0.0)'
    },
    timeout: 10000
  };

  try {
    let response;
    if (method === 'POST') {
      response = await axios.post(url, {}, config);
    } else {
      response = await axios.get(url, config);
    }

    return {
      success: true,
      status: response.status,
      hasData: !!response.data,
      dataType: typeof response.data
    };
  } catch (error: any) {
    const isCloudflare = error.response?.data?.includes?.('<!DOCTYPE html>') ||
                         error.response?.status === 403;

    return {
      success: false,
      status: error.response?.status || 'timeout',
      error: error.message,
      cloudflare: isCloudflare
    };
  }
}

async function main() {
  console.log('🧪 Testing World Anvil API Endpoints\n');
  console.log('Testing which endpoints bypass Cloudflare...\n');

  for (const endpoint of endpoints) {
    if (endpoint.skip) continue;

    process.stdout.write(`${endpoint.method.padEnd(6)} ${endpoint.path.padEnd(25)} `);

    const result = await testEndpoint(endpoint.method, endpoint.path, endpoint.description);

    if (result.success) {
      console.log(`✅ ${result.status} - Works!`);
    } else if (result.cloudflare) {
      console.log(`🚫 Cloudflare blocked (${result.status})`);
    } else {
      console.log(`❌ ${result.status} - ${result.error}`);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n✨ Test complete!');
}

main();
