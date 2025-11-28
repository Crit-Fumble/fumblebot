/**
 * World Anvil Secret Models
 * Contains interfaces and types related to World Anvil secrets
 */
/**
 * Interface for secret reference
 */
export interface SecretRef {
    id: string;
    title: string;
    slug: string;
    world_id: string;
    user_id: string;
    [key: string]: any;
}
/**
 * Interface for secret data with varying levels of detail
 */
export interface SecretResponse {
    id: string;
    title: string;
    slug: string;
    world_id: string;
    user_id: string;
    content?: string;
    state?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
}
/**
 * Interface for secret creation input
 */
export interface SecretInput {
    title: string;
    world: {
        id: string;
    };
    content?: string;
    state?: string;
    [key: string]: any;
}
/**
 * Interface for secret update input
 */
export interface SecretUpdateInput {
    title?: string;
    content?: string;
    state?: string;
    [key: string]: any;
}
/**
 * Interface for API response from world-secrets endpoint
 */
export interface WorldSecretsResponse {
    success: boolean;
    entities: SecretRef[];
}
/**
 * Interface for request options to get secrets
 */
export interface SecretListOptions {
    offset?: number;
    limit?: number;
}
//# sourceMappingURL=WorldAnvilSecret.d.ts.map