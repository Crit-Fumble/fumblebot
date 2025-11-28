/**
 * World Anvil World Model
 * Represents a world in the World Anvil system
 */
export interface WorldAnvilWorld {
    id: string;
    title: string;
    slug: string;
    description?: string;
    creation_date?: string;
    tags?: string[];
    genres?: string[];
    image_url?: string;
    visibility?: 'public' | 'private' | 'unlisted';
    owner_id?: string;
    is_author_world?: boolean;
}
export interface WorldAnvilWorldResponse {
    id: string;
    title: string;
    slug: string;
    description?: string;
    creation_date?: string;
    tags?: string[];
    genres?: string[];
    image_url?: string;
    visibility?: string;
    owner?: {
        id: string;
        username: string;
    };
}
//# sourceMappingURL=WorldAnvilWorld.d.ts.map