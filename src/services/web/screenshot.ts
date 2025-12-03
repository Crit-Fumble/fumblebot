/**
 * Web Screenshot Service
 *
 * Captures screenshots of web pages using Playwright.
 * Used for embedding visual content in Discord responses.
 */

import { chromium, type Browser, type Page } from 'playwright';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

export interface WebScreenshotOptions {
  /**
   * Width of the screenshot viewport
   * @default 1280
   */
  width?: number;

  /**
   * Height of the screenshot viewport
   * @default 800
   */
  height?: number;

  /**
   * Wait time in milliseconds before taking screenshot
   * @default 1500
   */
  waitTime?: number;

  /**
   * Full page screenshot (scroll and capture entire page)
   * @default false
   */
  fullPage?: boolean;

  /**
   * Element selector to screenshot (optional)
   * If provided, only screenshots this element
   */
  selector?: string;

  /**
   * Scroll to a specific anchor/element before screenshotting
   */
  scrollToAnchor?: string;

  /**
   * Dark mode preference
   * @default false
   */
  darkMode?: boolean;
}

export interface WebScreenshotResult {
  /**
   * Path to the screenshot file
   */
  filePath: string;

  /**
   * Screenshot as base64 string
   */
  base64: string;

  /**
   * Screenshot buffer
   */
  buffer: Buffer;

  /**
   * Viewport size used
   */
  viewport: { width: number; height: number };

  /**
   * URL that was captured
   */
  url: string;

  /**
   * Page title
   */
  title: string;
}

export class WebScreenshotService {
  private browser: Browser | null = null;

  /**
   * Initialize the browser instance
   */
  async initialize(): Promise<void> {
    if (this.browser) return;

    console.log('[WebScreenshot] Launching Chromium browser...');
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    console.log('[WebScreenshot] Browser launched successfully');
  }

  /**
   * Close the browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('[WebScreenshot] Browser closed');
    }
  }

  /**
   * Capture screenshot of a web page
   */
  async captureScreenshot(
    url: string,
    options: WebScreenshotOptions = {}
  ): Promise<WebScreenshotResult> {
    // Ensure browser is initialized
    if (!this.browser) {
      await this.initialize();
    }

    if (!this.browser) {
      throw new Error('Failed to initialize browser');
    }

    // Set default options
    const width = options.width || 1280;
    const height = options.height || 800;
    const waitTime = options.waitTime || 1500;
    const fullPage = options.fullPage || false;

    console.log(`[WebScreenshot] Capturing screenshot of ${url}`);

    // Create new page with color scheme preference
    const page: Page = await this.browser.newPage({
      viewport: { width, height },
      colorScheme: options.darkMode ? 'dark' : 'light',
    });

    try {
      // Navigate to URL
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Scroll to anchor if specified
      if (options.scrollToAnchor) {
        try {
          // Try to scroll to element by ID
          await page.evaluate((anchor) => {
            const element = document.getElementById(anchor) || document.querySelector(`[name="${anchor}"]`);
            if (element) {
              element.scrollIntoView({ behavior: 'instant', block: 'start' });
            }
          }, options.scrollToAnchor);
          // Give time for scroll to complete
          await page.waitForTimeout(500);
        } catch (e) {
          console.warn(`[WebScreenshot] Could not scroll to anchor: ${options.scrollToAnchor}`);
        }
      }

      // Wait for page to stabilize
      await page.waitForTimeout(waitTime);

      // Get page title
      const title = await page.title();

      // Take screenshot
      let screenshotBuffer: Buffer;

      if (options.selector) {
        // Screenshot specific element
        const element = await page.$(options.selector);
        if (!element) {
          throw new Error(`Element not found: ${options.selector}`);
        }
        screenshotBuffer = await element.screenshot();
      } else {
        // Screenshot full page or viewport
        screenshotBuffer = await page.screenshot({
          fullPage,
          type: 'png',
        });
      }

      // Generate unique filename
      const filename = `web-${randomBytes(8).toString('hex')}.png`;
      const filePath = join(tmpdir(), filename);

      // Save to file
      await writeFile(filePath, screenshotBuffer);

      // Convert to base64
      const base64 = screenshotBuffer.toString('base64');

      console.log(`[WebScreenshot] Screenshot saved to ${filePath}`);

      return {
        filePath,
        base64,
        buffer: screenshotBuffer,
        viewport: { width, height },
        url,
        title,
      };
    } finally {
      // Close page
      await page.close();
    }
  }

  /**
   * Capture screenshot of Old Gus' Cypher SRD at a specific anchor
   */
  async captureCypherSrd(
    anchor: string,
    options: WebScreenshotOptions = {}
  ): Promise<WebScreenshotResult> {
    const baseUrl = 'https://callmepartario.github.io/og-csrd/';
    const url = anchor ? `${baseUrl}#${anchor}` : baseUrl;

    return this.captureScreenshot(url, {
      width: 800,
      height: 600,
      waitTime: 2000,
      scrollToAnchor: anchor,
      ...options,
    });
  }

  /**
   * Capture screenshot of 5e.tools at a specific page/anchor
   */
  async capture5eTools(
    category: string,
    anchor?: string,
    options: WebScreenshotOptions = {}
  ): Promise<WebScreenshotResult> {
    const url = anchor
      ? `https://5e.tools/${category}.html#${anchor}`
      : `https://5e.tools/${category}.html`;

    return this.captureScreenshot(url, {
      width: 1024,
      height: 768,
      waitTime: 3000, // 5e.tools needs more time to load
      ...options,
    });
  }
}

// Singleton instance
let webScreenshotService: WebScreenshotService | null = null;

/**
 * Get or create the web screenshot service instance
 */
export function getWebScreenshotService(): WebScreenshotService {
  if (!webScreenshotService) {
    webScreenshotService = new WebScreenshotService();
  }
  return webScreenshotService;
}

/**
 * Clean up screenshot service on process exit
 */
process.on('exit', async () => {
  if (webScreenshotService) {
    await webScreenshotService.close();
  }
});

process.on('SIGINT', async () => {
  if (webScreenshotService) {
    await webScreenshotService.close();
  }
  process.exit(0);
});
