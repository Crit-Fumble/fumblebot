/**
 * World Anvil Map Models
 * Contains interfaces and types related to World Anvil maps, layers, marker groups, and markers
 */

/**
 * Interface for map reference
 */
export interface MapRef {
  id: string;
  title: string;
  slug: string;
  world_id: string;
  user_id: string;
  image_url?: string;
  [key: string]: any; // For additional properties based on the schema
}

/**
 * Interface for map data with varying levels of detail
 */
export interface MapResponse {
  id: string;
  title: string;
  slug: string;
  world_id: string;
  user_id: string;
  image_url?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any; // For additional properties based on the schema
}

/**
 * Interface for map creation input
 */
export interface MapInput {
  title: string;
  world_id: string;
  image: string; // ID of an already uploaded image
  description?: string;
  [key: string]: any; // For additional properties
}

/**
 * Interface for map update input
 */
export interface MapUpdateInput {
  title?: string;
  description?: string;
  image?: string; // ID of an already uploaded image
  [key: string]: any; // For additional properties
}

/**
 * Interface for map layer reference
 */
export interface LayerRef {
  id: string;
  title: string;
  slug: string;
  map_id: string;
  image_url?: string;
  [key: string]: any; // For additional properties
}

/**
 * Interface for map layer data
 */
export interface LayerResponse {
  id: string;
  title: string;
  slug: string;
  map_id: string;
  image_url?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any; // For additional properties
}

/**
 * Interface for map layer creation input
 */
export interface LayerInput {
  title: string;
  map: {
    id: string;
  };
  image?: string; // ID of an already uploaded image
  description?: string;
  [key: string]: any; // For additional properties
}

/**
 * Interface for map layer update input
 */
export interface LayerUpdateInput {
  title?: string;
  description?: string;
  image?: string; // ID of an already uploaded image
  [key: string]: any; // For additional properties
}

/**
 * Interface for marker group reference
 */
export interface MarkerGroupRef {
  id: string;
  title: string;
  slug: string;
  map_id: string;
  [key: string]: any; // For additional properties
}

/**
 * Interface for marker group data
 */
export interface MarkerGroupResponse {
  id: string;
  title: string;
  slug: string;
  map_id: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any; // For additional properties
}

/**
 * Interface for marker group creation input
 */
export interface MarkerGroupInput {
  title: string;
  map: {
    id: string;
  };
  description?: string;
  [key: string]: any; // For additional properties
}

/**
 * Interface for marker group update input
 */
export interface MarkerGroupUpdateInput {
  title?: string;
  description?: string;
  [key: string]: any; // For additional properties
}

/**
 * Interface for marker reference
 */
export interface MarkerRef {
  id: string;
  title: string;
  slug: string;
  map_id: string;
  markergroup_id?: string;
  [key: string]: any; // For additional properties
}

/**
 * Interface for marker data with varying levels of detail
 */
export interface MarkerResponse {
  id: string;
  title: string;
  slug: string;
  map_id: string;
  markergroup_id?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: any; // For additional properties based on the schema
}

/**
 * Interface for marker creation input
 */
export interface MarkerInput {
  title: string;
  map: {
    id: string;
  };
  markergroup?: {
    id: string;
  };
  description?: string;
  latitude?: number;
  longitude?: number;
  [key: string]: any; // For additional properties
}

/**
 * Interface for marker update input
 */
export interface MarkerUpdateInput {
  title?: string;
  markergroup?: {
    id: string;
  } | null;
  description?: string;
  latitude?: number;
  longitude?: number;
  [key: string]: any; // For additional properties
}

/**
 * Interface for API response from world-maps endpoint
 */
export interface WorldMapsResponse {
  success: boolean;
  entities: MapRef[];
}

/**
 * Interface for API response from map-layers endpoint
 */
export interface MapLayersResponse {
  success: boolean;
  entities: LayerRef[];
}

/**
 * Interface for API response from map-markergroups endpoint
 */
export interface MapMarkerGroupsResponse {
  success: boolean;
  entities: MarkerGroupRef[];
}

/**
 * Interface for API response from map-markers endpoint
 */
export interface MapMarkersResponse {
  success: boolean;
  entities: MarkerRef[];
}

/**
 * Interface for API response from markergroup-markers endpoint
 */
export interface MarkerGroupMarkersResponse {
  success: boolean;
  entities: MarkerRef[];
}

/**
 * Interface for marker type reference
 */
export interface MarkerTypeRef {
  id: string;
  title: string;
  slug: string;
  world_id: string;
  image_url?: string;
  [key: string]: any; // For additional properties
}

/**
 * Interface for marker type data with varying levels of detail
 */
export interface MarkerTypeResponse {
  id: string;
  title: string;
  slug: string;
  world_id: string;
  image_url?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any; // For additional properties based on the schema
}

/**
 * Interface for marker type creation input
 */
export interface MarkerTypeInput {
  title: string;
  world: {
    id: string;
  };
  image?: string; // ID of an already uploaded image
  description?: string;
  [key: string]: any; // For additional properties
}

/**
 * Interface for marker type update input
 */
export interface MarkerTypeUpdateInput {
  title?: string;
  image?: string; // ID of an already uploaded image
  description?: string;
  [key: string]: any; // For additional properties
}

/**
 * Interface for marker types list response
 */
export interface MarkerTypesResponse {
  success: boolean;
  entities: MarkerTypeRef[];
}

/**
 * Interface for request options with pagination
 */
export interface MapListOptions {
  offset?: number;
  limit?: number;
}
