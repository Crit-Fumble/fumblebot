/**
 * World Anvil Timeline Models
 * Contains interfaces and types related to World Anvil timelines and historical entries
 */
/**
 * Granularity levels for API responses
 * Used to determine the detail level of returned objects
 */
export type GranularityLevel = '-1' | '0' | '1' | '2';
/**
 * Interface for timeline reference (granularity -1)
 */
export interface TimelineRef {
    id: string;
    title: string;
    slug: string;
    world_id: string;
    user_id: string;
    icon?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
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
    description?: string;
    icon?: string;
    created_at?: string;
    updated_at?: string;
    is_public?: boolean;
    content?: string;
    css?: string;
    image?: string;
    histories?: HistoryRef[];
    [key: string]: any;
}
/**
 * Interface for timeline creation input
 * Required fields: title and world.id
 */
export interface TimelineInput {
    title: string;
    world: {
        id: string;
    };
    description?: string;
    content?: string;
    icon?: string;
    css?: string;
    image?: string;
    is_public?: boolean;
    histories?: Array<{
        id: string;
    }>;
    [key: string]: any;
}
/**
 * Interface for timeline update input
 * All fields are optional as this is used for PATCH operations
 */
export interface TimelineUpdateInput {
    title?: string;
    description?: string;
    content?: string;
    icon?: string;
    css?: string;
    image?: string;
    is_public?: boolean;
    histories?: Array<{
        id: string;
    }>;
    [key: string]: any;
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
/**
 * Interface for historical entry reference (granularity -1)
 */
export interface HistoryRef {
    id: string;
    title: string;
    slug: string;
    world_id: string;
    user_id: string;
    year: string;
    date?: string;
    icon?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
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
    year: string;
    date?: string;
    icon?: string;
    image?: string;
    is_public?: boolean;
    created_at?: string;
    updated_at?: string;
    content?: string;
    css?: string;
    timelines?: TimelineRef[];
    timeline_ids?: string[];
    [key: string]: any;
}
/**
 * Interface for historical entry creation input
 * Required fields: title, world.id, and year
 */
export interface HistoryInput {
    title: string;
    world: {
        id: string;
    };
    year: string;
    date?: string;
    content?: string;
    icon?: string;
    image?: string;
    is_public?: boolean;
    css?: string;
    timelines?: Array<{
        id: string;
    }>;
    [key: string]: any;
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
    timelines?: Array<{
        id: string;
    }>;
    [key: string]: any;
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
    offset?: number;
    limit?: number;
}
//# sourceMappingURL=WorldAnvilTimeline.d.ts.map