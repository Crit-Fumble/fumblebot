/**
 * Knowledge Base Client
 * Client for querying the Knowledge Base via Core server
 *
 * Note: KB content is managed in fumblebot.crit-fumble.com/kb/
 * but served by Core at /api/kb/* endpoints
 */

interface SearchOptions {
  query: string;
  system?: string;
  category?: string;
  limit?: number;
  similarityThreshold?: number;
}

interface SearchResult {
  id: string;
  title: string;
  system: string;
  category: string;
  excerpt: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  took: number;
}

interface Document {
  id: string;
  title: string;
  system: string;
  category: string;
  type: 'markdown' | 'json';
  path: string;
  content: string;
  metadata: Record<string, unknown>;
  sizeBytes: number;
  lastModified: string;
}

interface VersionInfo {
  version: string;
  lastUpdated: string;
  totalDocuments: number;
  systems: string[];
}

export class KnowledgeBaseClient {
  private baseUrl: string;
  private apiSecret: string;
  private timeout: number;

  constructor(options?: {
    baseUrl?: string;
    apiSecret?: string;
    timeout?: number;
  }) {
    // Use Core server URL (KB is served by Core at /api/kb/*)
    this.baseUrl = options?.baseUrl || process.env.CORE_SERVER_URL || 'http://localhost:4000';
    this.apiSecret = options?.apiSecret || process.env.CORE_SECRET || '';
    this.timeout = options?.timeout || 30000;

    // Remove trailing slash
    this.baseUrl = this.baseUrl.replace(/\/$/, '');
  }

  /**
   * Check if KB service is available
   */
  async health(): Promise<boolean> {
    try {
      const response = await this.request<{ status: string }>('/health');
      return response.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Get version information
   */
  async getVersion(): Promise<VersionInfo> {
    return this.request<VersionInfo>('/api/kb/version');
  }

  /**
   * Search the knowledge base
   */
  async search(options: SearchOptions): Promise<SearchResponse> {
    return this.request<SearchResponse>('/api/kb/search', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  /**
   * Get a specific document by ID
   */
  async getDocument(id: string): Promise<Document> {
    return this.request<Document>(`/api/kb/documents/${id}`);
  }

  /**
   * List all available systems
   */
  async listSystems(): Promise<string[]> {
    const response = await this.request<{ systems: string[] }>('/api/kb/systems');
    return response.systems;
  }

  /**
   * List documents in a system
   */
  async listSystemDocuments(systemId: string): Promise<Document[]> {
    const response = await this.request<{ documents: Document[] }>(
      `/api/kb/systems/${systemId}/documents`
    );
    return response.documents;
  }

  /**
   * Get system-specific rules
   */
  async getSystemRules(systemId: string): Promise<Document[]> {
    const response = await this.request<{ rules: Document[] }>(
      `/api/kb/systems/${systemId}/rules`
    );
    return response.rules;
  }

  /**
   * Get system-specific spells
   */
  async getSystemSpells(systemId: string): Promise<Record<string, unknown>[]> {
    const response = await this.request<{ spells: Record<string, unknown>[] }>(
      `/api/kb/systems/${systemId}/spells`
    );
    return response.spells;
  }

  /**
   * Get system-specific monsters
   */
  async getSystemMonsters(systemId: string): Promise<Record<string, unknown>[]> {
    const response = await this.request<{ monsters: Record<string, unknown>[] }>(
      `/api/kb/systems/${systemId}/monsters`
    );
    return response.monsters;
  }

  /**
   * Internal request method
   */
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    // Add auth header if secret is configured
    // Core uses X-Core-Secret for service-to-service auth
    if (this.apiSecret) {
      headers['X-Core-Secret'] = this.apiSecret;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`KB API error (${response.status}): ${error}`);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`KB API timeout after ${this.timeout}ms`);
        }
        throw error;
      }

      throw new Error('Unknown KB API error');
    }
  }
}

/**
 * Singleton instance
 * Uses environment variables for configuration
 * KB is served by Core server at /api/kb/* endpoints
 */
export const knowledgeBaseClient = new KnowledgeBaseClient();

/**
 * Helper function to check if KB is configured
 * Requires Core server URL and secret for authentication
 */
export function isKnowledgeBaseConfigured(): boolean {
  return !!(process.env.CORE_SERVER_URL && process.env.CORE_SECRET);
}

/**
 * Helper function to get KB client with error handling
 */
export function getKnowledgeBaseClient(): KnowledgeBaseClient {
  if (!isKnowledgeBaseConfigured()) {
    throw new Error('Knowledge Base is not configured. Set CORE_SERVER_URL and CORE_SECRET.');
  }
  return knowledgeBaseClient;
}
