/**
 * World Anvil RPG System Model
 * Represents an RPG system in World Anvil
 */

/**
 * World Anvil RPG System Response
 * Represents the API response structure for RPG systems
 */
export interface WorldAnvilRpgSystemResponse {
  id: number;
  name: string;
  slug: string;
  description?: string;
  publisher?: string;
  official: boolean;
  community_created?: boolean;
  icon_url?: string;
  image_url?: string;
}

/**
 * World Anvil RPG System
 * Our internal model representation of an RPG system
 */
export interface WorldAnvilRpgSystem {
  id: number;
  name: string;
  slug: string;
  description?: string;
  publisher?: string;
  official: boolean;
  communityCreated?: boolean;
  iconUrl?: string;
  imageUrl?: string;
}

/**
 * World Anvil RPG Systems List Response
 * Response format for listing RPG systems
 */
export interface WorldAnvilRpgSystemsListResponse {
  success: boolean;
  entities: WorldAnvilRpgSystemResponse[];
}
