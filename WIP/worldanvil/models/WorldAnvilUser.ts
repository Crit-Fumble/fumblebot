/**
 * World Anvil User Model
 * Represents a user in the World Anvil system
 */

export interface WorldAnvilUser {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  subscription_type?: string;
  is_author?: boolean;
  authorization?: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}

export interface WorldAnvilUserResponse {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  subscription_type?: string;
  is_author?: boolean;
  worlds?: string[]; // Array of world IDs
}
