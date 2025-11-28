/**
 * World Anvil Category Models
 * Contains interfaces and types related to World Anvil categories
 */
/**
 * Interface for category reference
 */
export interface CategoryRef {
    id: string;
    title: string;
    slug: string;
    world_id: string;
    parent_id?: string;
    [key: string]: any;
}
/**
 * Interface for category data with varying levels of detail
 */
export interface CategoryResponse {
    id: string;
    title: string;
    slug: string;
    world_id: string;
    parent_id?: string;
    description?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
}
/**
 * Interface for category creation input
 */
export interface CategoryInput {
    title: string;
    world_id: string;
    parent_id?: string;
    description?: string;
    [key: string]: any;
}
/**
 * Interface for API response from world-categories endpoint
 */
export interface WorldCategoriesResponse {
    success: boolean;
    entities: CategoryRef[];
}
/**
 * Interface for request options to get categories
 */
export interface CategoryListOptions {
    offset?: number;
    limit?: number;
}
//# sourceMappingURL=WorldAnvilCategory.d.ts.map