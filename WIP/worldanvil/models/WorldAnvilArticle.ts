/**
 * World Anvil Article Models
 * Contains interfaces and types related to World Anvil articles
 */

/**
 * Interface for article responses from World Anvil API
 */
export interface WorldAnvilArticleResponse {
  id: string;
  title: string;
  slug: string;
  content: string;
  world_id: string;
  category_id?: string;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
  template?: string;
  excerpt?: string;
  tags?: string[];
  position?: number;
  wordcount?: number;
}

/**
 * Interface for creating/updating an article
 */
export interface WorldAnvilArticleInput {
  title: string;
  content: string;
  world_id: string;
  category_id?: string;
  is_draft?: boolean;
  template?: string;
  excerpt?: string;
  tags?: string[];
}

/**
 * Interface for article list options
 */
export interface ArticleListOptions {
  page?: number;
  limit?: number;
  sort?: 'created_at' | 'updated_at' | 'title';
  order?: 'asc' | 'desc';
  world_id?: string;
  category_id?: string;
  is_draft?: boolean;
}

/**
 * Interface for article list response
 */
export interface ArticleListResponse {
  articles: WorldAnvilArticleResponse[];
  total: number;
  page: number;
  pages: number;
}
