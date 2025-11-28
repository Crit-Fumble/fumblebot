/**
 * Jest setup file
 * Configure the testing environment here
 */

// Import Jest's extended expect functionality
import { expect } from '@jest/globals';

// Set a longer timeout for tests if needed
jest.setTimeout(10000);

// Reset all mocks after each test
afterEach(() => {
  jest.resetAllMocks();
});
