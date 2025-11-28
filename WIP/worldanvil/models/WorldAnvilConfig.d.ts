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
/**
 * Required configuration keys that must be set
 */
export declare const REQUIRED_CONFIG_KEYS: string[];
/**
 * Set World Anvil configuration from host application
 * @param config Configuration object to use
 * @throws Error if required configuration keys are missing
 */
export declare function setWorldAnvilConfig(config: Partial<WorldAnvilConfig>): void;
/**
 * Get World Anvil configuration
 * @returns World Anvil configuration
 * @throws Error if configuration has not been set
 */
export declare function getWorldAnvilConfig(): WorldAnvilConfig;
/**
 * Reset the WorldAnvil config to default values (for testing only)
 * @internal This function should only be used in tests
 */
export declare function resetWorldAnvilConfigForTests(): void;
//# sourceMappingURL=WorldAnvilConfig.d.ts.map