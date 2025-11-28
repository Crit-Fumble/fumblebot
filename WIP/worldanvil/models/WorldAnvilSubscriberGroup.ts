/**
 * World Anvil Subscriber Group Models
 * Contains interfaces and types related to World Anvil subscriber groups
 */

/**
 * Interface for subscriber group reference
 */
export interface SubscriberGroupRef {
  id: string;
  title: string;
  slug: string;
  world_id: string;
  user_id: string;
  [key: string]: any; // For additional properties based on the schema
}

/**
 * Interface for subscriber group data with varying levels of detail
 */
export interface SubscriberGroupResponse {
  id: string;
  title: string;
  slug: string;
  world_id: string;
  user_id: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any; // For additional properties based on the schema
}

/**
 * Interface for subscriber group creation input
 */
export interface SubscriberGroupInput {
  title: string;
  world: {
    id: string;
  };
  description?: string;
  [key: string]: any; // For additional properties
}

/**
 * Interface for subscriber group update input
 */
export interface SubscriberGroupUpdateInput {
  title?: string;
  description?: string;
  [key: string]: any; // For additional properties
}

/**
 * Interface for API response from world-subscribergroups endpoint
 */
export interface WorldSubscriberGroupsResponse {
  success: boolean;
  entities: SubscriberGroupRef[];
}

/**
 * Interface for request options to get subscriber groups
 */
export interface SubscriberGroupListOptions {
  offset?: number;
  limit?: number;
}
