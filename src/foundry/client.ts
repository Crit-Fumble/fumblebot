/**
 * Foundry VTT Client
 *
 * HTTP client for communicating with Foundry VTT instances via the foundry-fumblebot module
 * Version: 0.1.0 (Proof of Concept)
 */

import type {
  FoundryHealthResponse,
  FoundryChatMessage,
  FoundryChatOptions,
  FoundryClientConfig,
} from './types.js';

export class FoundryClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(config: FoundryClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 10000; // 10 second default timeout
  }

  /**
   * Health check - Test connection to Foundry instance
   * POC: This will need to be updated once we implement proper REST endpoints
   *
   * For now, we'll just check if the Foundry instance is responding
   */
  async healthCheck(): Promise<FoundryHealthResponse> {
    try {
      // For POC, check if Foundry is responding on the main port
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.baseUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Foundry instance returned status ${response.status}`);
      }

      // TODO: Phase 1 - Implement actual health endpoint that returns module info
      return {
        status: 'ok',
        version: '0.1.0',
        foundryVersion: 'unknown',
        worldId: 'unknown',
        worldTitle: 'unknown',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Health check timed out after ${this.timeout}ms`);
        }
        throw new Error(`Health check failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get chat messages
   * TODO: Phase 1 - Implement via module REST API
   */
  async getChatMessages(limit: number = 10): Promise<FoundryChatMessage[]> {
    throw new Error('Not implemented - Phase 1 feature');
  }

  /**
   * Send chat message
   * TODO: Phase 1 - Implement via module REST API
   */
  async sendChatMessage(
    message: string,
    options?: FoundryChatOptions
  ): Promise<void> {
    throw new Error('Not implemented - Phase 1 feature');
  }

  /**
   * Check authentication
   * TODO: Phase 1 - Implement via module REST API
   */
  async checkAuth(): Promise<boolean> {
    throw new Error('Not implemented - Phase 1 feature');
  }

  /**
   * Make authenticated request to module API
   * TODO: Phase 1 - Implement when we have proper REST endpoints
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
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
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timed out after ${this.timeout}ms`);
        }
        throw new Error(`Request failed: ${error.message}`);
      }
      throw error;
    }
  }
}
