#!/usr/bin/env node
/**
 * Standalone script to start the Discord Activity server
 * Can be run independently or integrated with the main bot
 */

import { ActivityServer } from './server.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration from environment
const config = {
  port: parseInt(process.env.FUMBLEBOT_ACTIVITY_PORT || '3000'),
  host: process.env.FUMBLEBOT_ACTIVITY_HOST || '0.0.0.0',
  publicUrl: process.env.FUMBLEBOT_ACTIVITY_PUBLIC_URL || 'http://localhost:3000',
};

// Create and start server
const server = new ActivityServer(config);

async function main() {
  try {
    console.log('[Activity] Starting Discord Activity server...');
    console.log('[Activity] Configuration:', {
      port: config.port,
      host: config.host,
      publicUrl: config.publicUrl,
    });

    await server.start();

    console.log('[Activity] ✅ Server is ready!');
    console.log('[Activity] Test URL: http://localhost:' + config.port + '/discord/activity');
  } catch (error) {
    console.error('[Activity] ❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Activity] Shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[Activity] Shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

// Start the server
main();
