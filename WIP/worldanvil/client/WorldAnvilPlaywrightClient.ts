/**
 * World Anvil API Client with Cloudflare Bypass
 *
 * This client attempts standard HTTP requests first, and only uses Playwright
 * as a fallback when Cloudflare bot protection blocks the request.
 */

import axios, { AxiosError } from 'axios';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

export interface WorldAnvilPlaywrightClientConfig {
  apiUrl?: string;
  apiKey: string;
  authToken: string;
  userAgent?: string;
}

interface PlaywrightSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  lastUsed: number;
}

export class WorldAnvilPlaywrightClient {
  private config: Required<WorldAnvilPlaywrightClientConfig>;
  private session?: PlaywrightSession;
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes

  constructor(config: WorldAnvilPlaywrightClientConfig) {
    this.config = {
      apiUrl: config.apiUrl || 'https://www.worldanvil.com/api/external/boromir',
      apiKey: config.apiKey,
      authToken: config.authToken,
      userAgent: config.userAgent || 'Crit-Fumble (https://www.crit-fumble.com, 1.0.0)',
    };
  }

  /**
   * Check if response is a Cloudflare challenge
   */
  private isCloudflareChallenge(error: any): boolean {
    if (axios.isAxiosError(error)) {
      const response = error.response;
      if (response?.status === 403 &&
          typeof response.data === 'string' &&
          response.data.includes('Just a moment')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Make a GET request, falling back to Playwright if Cloudflare blocks
   */
  async get<T = any>(endpoint: string): Promise<T> {
    const url = `${this.config.apiUrl}${endpoint}`;

    // Step 1: Try standard axios request first
    console.log(`[WorldAnvil] Attempting standard request to: ${endpoint}`);
    try {
      const response = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': this.config.userAgent,
          'x-application-key': this.config.apiKey,
          'x-auth-token': this.config.authToken,
        },
        timeout: 10000,
      });

      console.log(`[WorldAnvil] ✓ Standard request succeeded`);
      return response.data;
    } catch (error) {
      // Step 2: Check if it's a Cloudflare challenge
      if (this.isCloudflareChallenge(error)) {
        console.log(`[WorldAnvil] ⚠ Cloudflare challenge detected, using Playwright bypass...`);
        return this.getWithPlaywright<T>(endpoint);
      }

      // If it's not a Cloudflare issue, throw the original error
      console.error(`[WorldAnvil] ✗ Request failed:`, error);
      throw error;
    }
  }

  /**
   * Make a GET request using Playwright to bypass Cloudflare
   */
  private async getWithPlaywright<T = any>(endpoint: string): Promise<T> {
    const url = `${this.config.apiUrl}${endpoint}`;

    // Ensure we have an active Playwright session
    await this.ensureSession();

    if (!this.session) {
      throw new Error('Failed to create Playwright session');
    }

    try {
      // Use page.evaluate to make fetch request with custom headers
      const result = await this.session.page.evaluate(
        async ({ url, apiKey, authToken }) => {
          try {
            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-application-key': apiKey,
                'x-auth-token': authToken,
              },
            });

            const status = response.status;
            const text = await response.text();

            return {
              success: true,
              status,
              body: text,
            };
          } catch (error: any) {
            return {
              success: false,
              error: error.message,
            };
          }
        },
        {
          url,
          apiKey: this.config.apiKey,
          authToken: this.config.authToken,
        }
      );

      if (!result.success) {
        throw new Error(`Playwright fetch failed: ${result.error}`);
      }

      if (result.status >= 400) {
        const error: any = new Error(`API returned status ${result.status}: ${result.body}`);
        error.status = result.status;
        error.body = result.body;
        throw error;
      }

      console.log(`[WorldAnvil] ✓ Playwright request succeeded`);

      // Parse JSON response
      try {
        return JSON.parse(result.body);
      } catch {
        return result.body as T;
      }
    } catch (error) {
      console.error(`[WorldAnvil] ✗ Playwright request failed:`, error);
      throw error;
    } finally {
      // Update last used timestamp
      if (this.session) {
        this.session.lastUsed = Date.now();
      }
    }
  }

  /**
   * Ensure we have an active Playwright session
   */
  private async ensureSession(): Promise<void> {
    const now = Date.now();

    // Check if existing session is still valid
    if (this.session && (now - this.session.lastUsed) < this.sessionTimeout) {
      return;
    }

    // Close old session if it exists
    if (this.session) {
      console.log(`[WorldAnvil] Closing expired Playwright session`);
      await this.closeSession();
    }

    // Create new session
    console.log(`[WorldAnvil] Creating new Playwright session...`);
    const browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    this.session = {
      browser,
      context,
      page,
      lastUsed: now,
    };

    console.log(`[WorldAnvil] ✓ Playwright session created`);
  }

  /**
   * Close the Playwright session
   */
  private async closeSession(): Promise<void> {
    if (this.session) {
      try {
        await this.session.browser.close();
      } catch (error) {
        console.error(`[WorldAnvil] Error closing Playwright session:`, error);
      }
      this.session = undefined;
    }
  }

  /**
   * Clean up resources when done
   */
  async destroy(): Promise<void> {
    await this.closeSession();
  }

  /**
   * Get current user identity
   */
  async getIdentity() {
    return this.get('/identity');
  }

  /**
   * Get current user
   */
  async getCurrentUser() {
    return this.get('/user');
  }

  /**
   * Get user's worlds
   */
  async getMyWorlds() {
    return this.get('/user/worlds');
  }

  /**
   * Get world by ID
   */
  async getWorldById(worldId: string) {
    return this.get(`/world/${worldId}`);
  }
}
