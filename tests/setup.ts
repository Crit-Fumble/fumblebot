/**
 * Vitest Test Setup
 * Global test configuration and mocks
 */

import { vi } from 'vitest';

// Mock environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.DISCORD_TOKEN = 'test-discord-token';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.FOUNDRY_URL = 'http://localhost:30000';

// Suppress console errors in tests (optional)
// global.console = {
//   ...console,
//   error: vi.fn(),
//   warn: vi.fn(),
// };
