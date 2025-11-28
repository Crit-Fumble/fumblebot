
/**
 * Interface for the identity response from World Anvil API
 * Based on the user-identity.yml specification
 */
export interface WorldAnvilIdentityResponse {
  id: string; // UUID format
  success: boolean;
  username: string;
  userhash: string;
  // These fields may be returned by the API but aren't in the official spec
  display_name?: string;
  subscription_type?: string;
  is_author?: boolean;
  avatar_url?: string;
}

/**
 * Simplified interface for user identity information
 */
export interface WorldAnvilIdentity {
  id: string;
  username: string;
  userhash: string;
  success: boolean;
  // These are mapped from additional fields that might be returned
  displayName?: string;
  subscriptionType?: string;
  isAuthor?: boolean;
  avatarUrl?: string;
}