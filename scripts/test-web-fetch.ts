/**
 * Test script for WebFetchService
 * Run with: npx tsx scripts/test-web-fetch.ts
 */

import { webFetchService, ALLOWED_DOMAINS } from '../src/services/web/index.js';

async function testWebFetch() {
  console.log('=== WebFetchService Test ===\n');

  // Test 1: Check allowed domains
  console.log('1. Allowed Domains:');
  console.log('   ', ALLOWED_DOMAINS.join(', '));
  console.log();

  // Test 2: Test URL validation
  console.log('2. URL Validation:');
  const testUrls = [
    'https://5e.tools/spells.html#fireball',
    'https://www.dndbeyond.com/spells/fireball',
    'https://foundryvtt.com/kb/api/',
    'https://tools.cypher-system.com/',
    'https://google.com/', // Should be blocked
    'https://evil-site.com/', // Should be blocked
  ];

  for (const url of testUrls) {
    const allowed = webFetchService.isAllowed(url);
    console.log(`   ${allowed ? '✓' : '✗'} ${url}`);
  }
  console.log();

  // Test 3: Fetch from 5e.tools
  console.log('3. Fetching from 5e.tools (fireball spell):');
  try {
    const result = await webFetchService.search5eTools('fireball', 'spells');
    if (result.success) {
      console.log('   ✓ Fetch successful');
      console.log('   Title:', result.title);
      console.log('   Content length:', result.content?.length || 0, 'chars');
      console.log('   Source:', result.source);
      console.log('   Cached:', result.cached);
      // Show first 200 chars of content
      if (result.content) {
        console.log('   Preview:', result.content.substring(0, 200) + '...');
      }
    } else {
      console.log('   ✗ Fetch failed:', result.error);
    }
  } catch (error) {
    console.log('   ✗ Error:', error);
  }
  console.log();

  // Test 4: Fetch from blocked domain
  console.log('4. Fetching from blocked domain (google.com):');
  try {
    const result = await webFetchService.fetch('https://google.com/');
    if (result.success) {
      console.log('   ✗ Should have been blocked!');
    } else {
      console.log('   ✓ Correctly blocked:', result.error);
    }
  } catch (error) {
    console.log('   ✓ Correctly blocked:', error);
  }
  console.log();

  // Test 5: Cache stats
  console.log('5. Cache Stats:');
  const stats = webFetchService.getCacheStats();
  console.log('   Size:', stats.size, '/', stats.maxSize);
  console.log('   TTL:', stats.ttlMinutes, 'minutes');
  console.log();

  console.log('=== Test Complete ===');
}

testWebFetch().catch(console.error);
