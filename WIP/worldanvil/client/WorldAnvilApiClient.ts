/**
 * World Anvil API Client
 * Server-side client for interacting with World Anvil API
 */

import axios, { AxiosResponse } from 'axios';
import { WorldAnvilUser } from '../models/WorldAnvilUser';
import { WorldAnvilWorld } from '../models/WorldAnvilWorld';
import { getWorldAnvilConfig } from '../models/WorldAnvilConfig';
import {
  WorldAnvilOAuthConfig,
  WorldAnvilTokenResponse,
  WorldAnvilOAuthUserProfile,
  WorldAnvilOAuthResult
} from '../models/WorldAnvilOAuth';

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
  oauth?: WorldAnvilOAuthConfig;
}

export class WorldAnvilApiClient {
  private client: IWorldAnvilHttpClient;
  private apiKey?: string;
  private accessToken?: string;
  private baseUrl: string;

  /**
   * Creates a new WorldAnvilApiClient instance
   * 
   * @param config Optional explicit config (overrides global config)
   * @param customHttpClient Optional HTTP client for testing
   */
  constructor(config?: WorldAnvilApiClientConfig, customHttpClient?: IWorldAnvilHttpClient) {
    // Get configuration from global config if not explicitly provided
    let effectiveConfig: WorldAnvilApiClientConfig;
    
    try {
      // Try to get global config first
      const globalConfig = getWorldAnvilConfig();
      // Override with explicitly provided config if any
      effectiveConfig = {
        apiUrl: globalConfig.apiUrl,
        apiKey: globalConfig.apiKey,
        accessToken: globalConfig.accessToken,
        ...config
      };
    } catch (e) {
      // Fallback to provided config or empty if global config not available
      effectiveConfig = config || {};
    }
    
    this.apiKey = effectiveConfig.apiKey;
    this.accessToken = effectiveConfig.accessToken;
    this.baseUrl = effectiveConfig.apiUrl || 'https://www.worldanvil.com/api/external/boromir';

    // Use custom HTTP client for testing if provided, otherwise create axios instance
    if (customHttpClient) {
      this.client = customHttpClient;
    } else {
      const axiosInstance = axios.create({
        baseURL: this.baseUrl,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      // Add request interceptor to add auth headers
      axiosInstance.interceptors.request.use((request) => {
        if (this.apiKey) {
          request.headers['x-application-key'] = this.apiKey;
        }

        if (this.accessToken) {
          request.headers['x-auth-token'] = this.accessToken;
        }

        // Add User-Agent header as required by World Anvil API
        request.headers['User-Agent'] = 'Crit-Fumble (https://www.crit-fumble.com, 1.0.0)';

        return request;
      });

      // Create adapter to match IWorldAnvilHttpClient interface
      this.client = {
        get: <T>(url: string, config?: any) => axiosInstance.get<T, AxiosResponse<T>>(url, config).then(res => res.data),
        post: <T>(url: string, data?: any, config?: any) => axiosInstance.post<T, AxiosResponse<T>>(url, data, config).then(res => res.data),
        put: <T>(url: string, data?: any, config?: any) => axiosInstance.put<T, AxiosResponse<T>>(url, data, config).then(res => res.data),
        patch: <T>(url: string, data?: any, config?: any) => axiosInstance.patch<T, AxiosResponse<T>>(url, data, config).then(res => res.data),
        delete: <T>(url: string, config?: any) => axiosInstance.delete<T, AxiosResponse<T>>(url, config).then(res => res.data)
      };
    }
  }

  /**
   * Set the API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Set the access token
   */
  setAccessToken(accessToken: string): void {
    this.accessToken = accessToken;
  }

  /**
   * Make a generic GET request to the World Anvil API
   */
  async get<T = any>(url: string, config?: any): Promise<T> {
    try {
      return await this.client.get<T>(url, config);
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }

  /**
   * Make a generic POST request to the World Anvil API
   */
  async post<T = any>(url: string, data?: any, config?: any): Promise<T> {
    try {
      return await this.client.post<T>(url, data, config);
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }

  /**
   * Make a generic PUT request to the World Anvil API
   */
  async put<T = any>(url: string, data?: any, config?: any): Promise<T> {
    try {
      return await this.client.put<T>(url, data, config);
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }

  /**
   * Make a generic PATCH request to the World Anvil API
   */
  async patch<T = any>(url: string, data?: any, config?: any): Promise<T> {
    try {
      return await this.client.patch<T>(url, data, config);
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }

  /**
   * Make a generic DELETE request to the World Anvil API
   */
  async delete<T = any>(url: string, config?: any): Promise<T> {
    try {
      return await this.client.delete<T>(url, config);
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }

  /**
   * Handle API errors
   */
  private handleApiError(error: any): void {
    // Handle Axios errors
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      const responseData = error.response?.data;

      // Handle specific error codes
      if (statusCode === 401) {
        console.error('Authentication failed. Please check your API key and access token.');
      } else if (statusCode === 403) {
        console.error('You do not have permission to access this resource.');
      } else if (statusCode === 429) {
        console.error('Rate limit exceeded. Please try again later.');
      } else {
        console.error(`API Error (${statusCode}):`, responseData);
      }
    } else {
      // Handle non-Axios errors
      console.error('World Anvil API Error:', error?.message || error);
    }
  }

  /**
   * Get the current user profile
   */
  async getCurrentUser(): Promise<WorldAnvilUser> {
    return this.get<WorldAnvilUser>('/user');
  }

  /**
   * Get a list of worlds for the current user
   */
  async getMyWorlds(): Promise<WorldAnvilWorld[]> {
    return this.get<WorldAnvilWorld[]>('/user/worlds');
  }

  /**
   * Get a world by ID
   */
  async getWorldById(worldId: string): Promise<WorldAnvilWorld> {
    return this.get<WorldAnvilWorld>(`/world/${worldId}`);
  }

  // OAuth2 Methods

  /**
   * Generate WorldAnvil OAuth2 authorization URL
   * Note: Requires oauth configuration to be set
   */
  getOAuthAuthorizationUrl(state?: string): string {
    const config = (this as any).config?.oauth;
    if (!config) {
      throw new Error('OAuth configuration not provided');
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
    });

    if (state) {
      params.set('state', state);
    }

    // Note: This is a placeholder URL - actual WorldAnvil OAuth endpoints need to be confirmed
    return `https://www.worldanvil.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange OAuth authorization code for access token
   * Note: Implementation pending WorldAnvil OAuth2 documentation
   */
  async exchangeCodeForToken(code: string, _state?: string): Promise<WorldAnvilOAuthResult> {
    const config = (this as any).config?.oauth;
    if (!config) {
      return {
        success: false,
        error: 'OAuth configuration not provided'
      };
    }

    try {
      const tokenData = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.redirectUri,
      });

      // Note: This endpoint URL is a placeholder - actual WorldAnvil OAuth endpoints need to be confirmed
      const response = await fetch('https://www.worldanvil.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Crit-Fumble/1.0',
        },
        body: tokenData.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const tokens = await response.json() as WorldAnvilTokenResponse;

      // Get user profile with the access token
      const userProfile = await this.getOAuthUserProfile(tokens.access_token);

      return {
        success: true,
        user: userProfile,
        tokens,
      };
    } catch (error) {
      console.error('WorldAnvil OAuth token exchange error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown OAuth error'
      };
    }
  }

  /**
   * Get user profile using OAuth access token
   * Note: Implementation pending WorldAnvil user API documentation
   */
  async getOAuthUserProfile(accessToken: string): Promise<WorldAnvilOAuthUserProfile> {
    try {
      // Note: This endpoint URL is a placeholder - actual WorldAnvil user API endpoints need to be confirmed
      const response = await fetch('https://www.worldanvil.com/api/v1/user/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'Crit-Fumble/1.0',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const userData = await response.json() as any;

      return {
        id: userData.id,
        username: userData.username,
        displayName: userData.displayName || userData.username,
        email: userData.email,
        avatar: userData.avatar,
        isPremium: userData.isPremium,
        subscription: userData.subscription,
      };
    } catch (error) {
      console.error('Failed to get WorldAnvil user profile:', error);
      throw error;
    }
  }

  /**
   * Refresh OAuth access token
   * Note: Implementation pending WorldAnvil OAuth2 refresh token support
   */
  async refreshOAuthToken(refreshToken: string): Promise<WorldAnvilTokenResponse> {
    const config = (this as any).config?.oauth;
    if (!config) {
      throw new Error('OAuth configuration not provided');
    }

    try {
      const tokenData = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      // Note: This endpoint URL is a placeholder - actual WorldAnvil OAuth endpoints need to be confirmed
      const response = await fetch('https://www.worldanvil.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Crit-Fumble/1.0',
        },
        body: tokenData.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json() as WorldAnvilTokenResponse;
    } catch (error) {
      console.error('Failed to refresh WorldAnvil token:', error);
      throw error;
    }
  }

  /**
   * Revoke OAuth access token
   * Note: Implementation pending WorldAnvil OAuth2 token revocation support
   */
  async revokeOAuthToken(accessToken: string): Promise<boolean> {
    const config = (this as any).config?.oauth;
    if (!config) {
      throw new Error('OAuth configuration not provided');
    }

    try {
      const tokenData = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        token: accessToken,
      });

      // Note: This endpoint URL is a placeholder - actual WorldAnvil OAuth endpoints need to be confirmed
      const response = await fetch('https://www.worldanvil.com/oauth/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Crit-Fumble/1.0',
        },
        body: tokenData.toString(),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to revoke WorldAnvil token:', error);
      return false;
    }
  }
}
