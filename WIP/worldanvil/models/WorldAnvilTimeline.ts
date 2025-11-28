/**
 * World Anvil Timeline Models
 * Contains interfaces and types related to World Anvil timelines and historical entries
 */

/**
 * Granularity levels for API responses
 * Used to determine the detail level of returned objects
 */
export type GranularityLevel = '-1' | '0' | '1' | '2';

// --------- Timeline Interfaces ---------

/**
 * Interface for timeline reference (granularity -1)
 */
export interface TimelineRef {
  id: string;
  title: string;
  slug: string;
  world_id: string;
  user_id: string;
  // Additional reference properties
  icon?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any; // For additional properties based on the schema
}

/**
 * Interface for timeline data with varying levels of detail
 * The fields returned depend on the granularity parameter:
 * - granularity -1: basic reference (TimelineRef)
 * - granularity 0: adds description and basic metadata
 * - granularity 1: adds content and more metadata
 * - granularity 2: adds full relationship data including histories
 */
export interface TimelineResponse {
  id: string;
  title: string;
  slug: string;
  world_id: string;
  user_id: string;
  
  // Basic metadata (granularity 0+)
  description?: string;
  icon?: string;
  created_at?: string;
  updated_at?: string;
  is_public?: boolean;
  
  // Content fields (granularity 1+)
  content?: string;
  css?: string;
  image?: string;
  
  // Relationship data (granularity 2)
  histories?: HistoryRef[]; // Array of historical entries in the timeline
  
  [key: string]: any; // For additional properties based on the schema
}

/**
 * Interface for timeline creation input
 * Required fields: title and world.id
 */
export interface TimelineInput {
  title: string; // Required - The title of the timeline
  world: {
    id: string; // Required - The ID of the world this timeline belongs to
  };
  description?: string; // Optional description for the timeline
  content?: string; // Optional content/body of the timeline
  icon?: string; // Optional icon for the timeline
  css?: string; // Optional custom CSS for the timeline
  image?: string; // Optional image URL for the timeline
  is_public?: boolean; // Optional visibility setting
  histories?: Array<{ id: string }>; // Optional historical entries to include
  [key: string]: any; // For additional properties
}

/**
 * Interface for timeline update input
 * All fields are optional as this is used for PATCH operations
 */
export interface TimelineUpdateInput {
  title?: string; // Optional updated title
  description?: string; // Optional updated description
  content?: string; // Optional updated content
  icon?: string; // Optional updated icon
  css?: string; // Optional updated CSS
  image?: string; // Optional updated image URL
  is_public?: boolean; // Optional updated visibility setting
  
  // For managing historical entries in the timeline
  // Can be used to add, remove, or reorder histories
  histories?: Array<{ id: string }>;
  
  [key: string]: any; // For additional properties
}

/**
 * Interface for API response from world-timelines endpoint
 */
export interface WorldTimelinesResponse {
  success: boolean;
  entities: TimelineRef[];
}

/**
 * Interface for request options to get timelines
 */
export interface TimelineListOptions {
  offset?: number;
  limit?: number;
}

// --------- Historical Entry Interfaces ---------

/**
 * Interface for historical entry reference (granularity -1)
 */
export interface HistoryRef {
  id: string;
  title: string;
  slug: string;
  world_id: string;
  user_id: string;
  year: string; // Year of the historical event (required field)
  date?: string; // Date of the historical event
  icon?: string; // Icon for the history entry
  created_at?: string;
  updated_at?: string;
  [key: string]: any; // For additional properties based on the schema
}

/**
 * Interface for historical entry data with varying levels of detail
 * The fields returned depend on the granularity parameter:
 * - granularity -1: basic reference (HistoryRef)
 * - granularity 0: adds more metadata
 * - granularity 1: adds content
 * - granularity 2: adds relationship data (timelines)
 */
export interface HistoryResponse {
  id: string;
  title: string;
  slug: string;
  world_id: string;
  user_id: string;
  year: string; // Year of the historical event (required)
  date?: string; // Date of the historical event
  
  // Metadata fields
  icon?: string; // Icon for the history entry
  image?: string; // Image URL for the history entry
  is_public?: boolean; // Visibility setting
  created_at?: string;
  updated_at?: string;
  
  // Content fields
  content?: string; // The main content/description of the historical event
  css?: string; // Custom CSS for this history entry
  
  // Relationship data
  timelines?: TimelineRef[]; // Timelines this history belongs to
  timeline_ids?: string[]; // IDs of timelines this historical entry belongs to (alternative format)
  
  [key: string]: any; // For additional properties based on the schema
}

/**
 * Interface for historical entry creation input
 * Required fields: title, world.id, and year
 */
export interface HistoryInput {
  title: string; // Required - The title of the historical entry
  world: {
    id: string; // Required - The ID of the world this history belongs to
  };
  year: string; // Required - Year of the historical event per API description
  
  // Optional fields
  date?: string; // More specific date information
  content?: string; // Content/description of the event
  icon?: string; // Icon for the event
  image?: string; // Image URL for the event
  is_public?: boolean; // Visibility setting
  css?: string; // Custom CSS
  
  // Timelines this history belongs to
  // A history can be part of multiple timelines
  timelines?: Array<{ id: string }>;
  
  [key: string]: any; // For additional properties
}

/**
 * Interface for historical entry update input
 * All fields are optional as this is used for PATCH operations
 */
export interface HistoryUpdateInput {
  title?: string;
  year?: string;
  date?: string;
  content?: string;
  icon?: string;
  image?: string;
  is_public?: boolean;
  css?: string;
  
  // For managing timeline associations
  // Can be used to add or remove this history from timelines
  timelines?: Array<{ id: string }>;
  
  [key: string]: any; // For additional properties
}

/**
 * Interface for API response from world-histories endpoint
 * Used when listing histories for a specific world
 */
export interface WorldHistoriesResponse {
  success: boolean;
  entities: HistoryRef[];
}

/**
 * Interface for request options to get historical entries
 */
export interface HistoryListOptions {
  offset?: number; // Number of items to skip
  limit?: number; // Maximum number of items to return
  // Additional filters could be added here
}
