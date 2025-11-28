/**
 * World Anvil Block Models
 * Contains interfaces and types related to World Anvil blocks and block folders
 */
/**
 * Interface for block response
 */
export interface BlockResponse {
    id: string;
    title: string;
    world_id: string;
    content?: string;
    folder_id?: string;
    created_at?: string;
    updated_at?: string;
    is_public?: boolean;
    slug?: string;
    [key: string]: any;
}
/**
 * Interface for block input
 */
export interface BlockInput {
    title: string;
    content: string;
    world_id: string;
    folder_id?: string;
    is_public?: boolean;
}
/**
 * Interface for block folder reference
 */
export interface BlockFolderRef {
    id: string;
    title: string;
    world_id: string;
    parent_id?: string;
    [key: string]: any;
}
/**
 * Interface for block folder response
 */
export interface BlockFolderResponse {
    id: string;
    title: string;
    world_id: string;
    description?: string;
    parent_id?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
}
/**
 * Interface for block folder input
 */
export interface BlockFolderInput {
    title: string;
    world_id: string;
    description?: string;
    parent_id?: string;
}
/**
 * Interface for API response from world-blockfolders endpoint
 */
export interface WorldBlockFoldersResponse {
    success: boolean;
    entities: BlockFolderRef[];
}
/**
 * Interface for API response from blockfolder-blocks endpoint
 */
export interface BlockFolderBlocksResponse {
    success: boolean;
    entities: BlockResponse[];
}
/**
 * Interface for request options to get block folders
 */
export interface BlockFolderListOptions {
    offset?: number;
    limit?: number;
}
//# sourceMappingURL=WorldAnvilBlock.d.ts.map