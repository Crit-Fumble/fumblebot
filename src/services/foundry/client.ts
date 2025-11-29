/**
 * Foundry VTT API Client
 * HTTP client for communicating with Foundry VTT instances
 */

export interface FoundryClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

export interface FoundryHealthResponse {
  status: 'ok' | 'error';
  version?: string;
  world?: string;
  system?: string;
  message?: string;
}

/**
 * Foundry VTT HTTP API Client
 */
export class FoundryClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(config: FoundryClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 10000;
  }

  /**
   * Check if Foundry VTT instance is running and accessible
   */
  async healthCheck(): Promise<FoundryHealthResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/status`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Try the root URL as fallback (some Foundry setups don't have /api/status)
        const rootResponse = await fetch(this.baseUrl, {
          method: 'HEAD',
          headers: this.getHeaders(),
        });

        if (rootResponse.ok) {
          return {
            status: 'ok',
            message: 'Foundry VTT is running (API status endpoint not available)',
          };
        }

        return {
          status: 'error',
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        status: 'ok',
        version: data.version,
        world: data.world,
        system: data.system,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          status: 'error',
          message: 'Connection timeout',
        };
      }

      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get request headers
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'FumbleBot/1.0',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }
}
