/**
 * World Anvil Canvas Models
 * Contains interfaces and types related to World Anvil canvases
 */
/**
 * Interface for canvas reference
 */
export interface CanvasRef {
    id: string;
    title: string;
    slug: string;
    world_id: string;
    [key: string]: any;
}
/**
 * Interface for canvas response with full details
 */
export interface CanvasResponse {
    id: string;
    title: string;
    slug: string;
    world_id: string;
    description?: string;
    created_at?: string;
    updated_at?: string;
    data?: any;
    [key: string]: any;
}
/**
 * Interface for canvas creation input
 */
export interface CanvasInput {
    title: string;
    world_id: string;
    description?: string;
    data?: any;
}
/**
 * Interface for API response from world-canvases endpoint
 */
export interface WorldCanvasesResponse {
    success: boolean;
    entities: CanvasRef[];
}
/**
 * Interface for request options to get canvases
 */
export interface CanvasListOptions {
    offset?: number;
    limit?: number;
}
//# sourceMappingURL=WorldAnvilCanvas.d.ts.map