/**
 * World Anvil Image Models
 * Contains interfaces and types related to World Anvil images
 */
/**
 * Interface for image reference
 */
export interface ImageRef {
    id: string;
    title: string;
    slug: string;
    filename: string;
    url: string;
    world_id: string;
    user_id: string;
    [key: string]: any;
}
/**
 * Interface for image response with full details
 */
export interface ImageResponse {
    id: string;
    title: string;
    slug: string;
    filename: string;
    url: string;
    world_id: string;
    user_id: string;
    description?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
}
/**
 * Interface for image update input
 * Note: Image creation via API is not yet implemented according to the specs
 */
export interface ImageUpdateInput {
    title?: string;
    description?: string;
    [key: string]: any;
}
/**
 * Interface for API response from world-images endpoint
 */
export interface WorldImagesResponse {
    success: boolean;
    entities: ImageRef[];
}
/**
 * Interface for request options to get images
 */
export interface ImageListOptions {
    offset?: number;
    limit?: number;
}
//# sourceMappingURL=WorldAnvilImage.d.ts.map