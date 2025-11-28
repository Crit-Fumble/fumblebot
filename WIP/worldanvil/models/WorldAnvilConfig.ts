/**
 * World Anvil configuration module
 * Provides access to World Anvil configuration for API access
 * 
 * This module accepts configuration directly from the host application.
 */

/**
 * World Anvil configuration interface
 */
export interface WorldAnvilConfig {
  /**
   * World Anvil API URL
   */
  apiUrl: string;
  
  /**
   * World Anvil API Key
   */
  apiKey: string;
  
  /**
   * Optional access token for authenticated requests
   */
  accessToken?: string;
}


// Default configuration
const defaultConfig: WorldAnvilConfig = {
  apiUrl: 'https://www.worldanvil.com/api/v1',
  apiKey: '',
  accessToken: undefined
};

// Singleton instance of the configuration
let configInstance: WorldAnvilConfig = { ...defaultConfig };

/**
 * Required configuration keys that must be set
 */
export const REQUIRED_CONFIG_KEYS = ['apiUrl', 'apiKey'];

/**
 * Set World Anvil configuration from host application
 * @param config Configuration object to use
 * @throws Error if required configuration keys are missing
 */
export function setWorldAnvilConfig(config: Partial<WorldAnvilConfig>): void {
  // For partial updates, use the existing config as base
  const currentConfig = { ...defaultConfig };
  
  // Apply new config values
  Object.assign(currentConfig, config);
  
  // Store the new configuration
  configInstance = currentConfig;
}

/**
 * Get World Anvil configuration
 * @returns World Anvil configuration
 * @throws Error if configuration has not been set
 */
export function getWorldAnvilConfig(): WorldAnvilConfig {
  // Validate required fields
  if (!configInstance.apiUrl || configInstance.apiUrl === defaultConfig.apiUrl) {
    throw new Error('World Anvil configuration not properly set. Call setWorldAnvilConfig() with required parameters first.');
  }
  
  if (!configInstance.apiKey || configInstance.apiKey === defaultConfig.apiKey) {
    throw new Error('World Anvil configuration not properly set. Call setWorldAnvilConfig() with required parameters first.');
  }
  
  return configInstance;
}


/**
 * Reset the WorldAnvil config to default values (for testing only)
 * @internal This function should only be used in tests
 */
export function resetWorldAnvilConfigForTests(): void {
  // Only allow this function to be called in test environments
  if (process.env.NODE_ENV !== 'test') {
    console.warn('resetWorldAnvilConfigForTests() should only be called in test environments');
    return;
  }
  
  // Reset to default values
  configInstance = { ...defaultConfig };
}
