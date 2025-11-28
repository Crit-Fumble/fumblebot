/**
 * World Anvil API Client
 * Server-side client for interacting with World Anvil API
 */
import { WorldAnvilUser } from '../models/WorldAnvilUser';
import { WorldAnvilWorld } from '../models/WorldAnvilWorld';
/**
 * Interface to define HTTP client functionality for dependency injection
 */
export interface IWorldAnvilHttpClient {
    get<T>(url: string, config?: any): Promise<T>;
    post<T>(url: string, data?: any, config?: any): Promise<T>;
    put<T>(url: string, data?: any, config?: any): Promise<T>;
    patch<T>(url: string, data?: any, config?: any): Promise<T>;
    delete<T>(url: string, config?: any): Promise<T>;
}
/**
 * Configuration options for WorldAnvilApiClient
 */
export interface WorldAnvilApiClientConfig {
    apiUrl?: string;
    apiKey?: string;
    accessToken?: string;
}
export declare class WorldAnvilApiClient {
    private client;
    private apiKey?;
    private accessToken?;
    private baseUrl;
    /**
     * Creates a new WorldAnvilApiClient instance
     *
     * @param config Optional explicit config (overrides global config)
     * @param customHttpClient Optional HTTP client for testing
     */
    constructor(config?: WorldAnvilApiClientConfig, customHttpClient?: IWorldAnvilHttpClient);
    /**
     * Set the API key
     */
    setApiKey(apiKey: string): void;
    /**
     * Set the access token
     */
    setAccessToken(accessToken: string): void;
    /**
     * Make a generic GET request to the World Anvil API
     */
    get<T = any>(url: string, config?: any): Promise<T>;
    /**
     * Make a generic POST request to the World Anvil API
     */
    post<T = any>(url: string, data?: any, config?: any): Promise<T>;
    /**
     * Make a generic PUT request to the World Anvil API
     */
    put<T = any>(url: string, data?: any, config?: any): Promise<T>;
    /**
     * Make a generic PATCH request to the World Anvil API
     */
    patch<T = any>(url: string, data?: any, config?: any): Promise<T>;
    /**
     * Make a generic DELETE request to the World Anvil API
     */
    delete<T = any>(url: string, config?: any): Promise<T>;
    /**
     * Handle API errors
     */
    private handleApiError;
    /**
     * Get the current user profile
     */
    getCurrentUser(): Promise<WorldAnvilUser>;
    /**
     * Get a list of worlds for the current user
     */
    getMyWorlds(): Promise<WorldAnvilWorld[]>;
    /**
     * Get a world by ID
     */
    getWorldById(worldId: string): Promise<WorldAnvilWorld>;
}
//# sourceMappingURL=WorldAnvilApiClient.d.ts.map