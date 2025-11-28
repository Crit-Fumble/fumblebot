/**
 * WorldAnvil OAuth2 Models
 * Types and interfaces for WorldAnvil OAuth2 authentication
 */

/**
 * WorldAnvil OAuth2 configuration
 */
export interface WorldAnvilOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * OAuth2 authorization URL parameters
 */
export interface WorldAnvilAuthUrlParams {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state?: string;
  responseType?: string;
}

/**
 * OAuth2 token exchange parameters
 */
export interface WorldAnvilTokenExchangeParams {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  grantType?: string;
}

/**
 * OAuth2 token response
 */
export interface WorldAnvilTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

/**
 * WorldAnvil user profile from OAuth
 */
export interface WorldAnvilOAuthUserProfile {
  id: string;
  username: string;
  displayName?: string;
  email?: string;
  avatar?: string;
  isPremium?: boolean;
  subscription?: string;
}

/**
 * WorldAnvil OAuth2 authentication result
 */
export interface WorldAnvilOAuthResult {
  success: boolean;
  user?: WorldAnvilOAuthUserProfile;
  tokens?: WorldAnvilTokenResponse;
  error?: string;
}