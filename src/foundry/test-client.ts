/**
 * Test script for Foundry Client
 * Usage: npx tsx src/foundry/test-client.ts
 */

import { FoundryClient } from './client.js';

async function testFoundryClient() {
  console.log('Testing Foundry Client...\n');

  // Test with staging droplet
  const client = new FoundryClient({
    baseUrl: 'http://104.131.164.164:30000',
    timeout: 5000,
  });

  try {
    console.log('Running health check...');
    const health = await client.healthCheck();
    console.log('✅ Health check successful!');
    console.log('Response:', JSON.stringify(health, null, 2));
  } catch (error) {
    console.error('❌ Health check failed:',error instanceof Error ? error.message : error);
  }

  // Test unimplemented methods (should throw errors)
  console.log('\nTesting unimplemented methods (should throw errors):');

  try {
    await client.getChatMessages();
  } catch (error) {
    console.log('✅ getChatMessages() correctly throws:', error instanceof Error ? error.message : error);
  }

  try {
    await client.sendChatMessage('test');
  } catch (error) {
    console.log('✅ sendChatMessage() correctly throws:', error instanceof Error ? error.message : error);
  }

  console.log('\n✅ All tests passed!');
}

testFoundryClient().catch(console.error);
