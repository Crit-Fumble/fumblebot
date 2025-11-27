/**
 * Foundry VTT Screenshot Service
 *
 * Captures screenshots of Foundry VTT instances using Playwright
 */

import { chromium, type Browser, type Page } from 'playwright';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

export interface ScreenshotOptions {
  /**
   * Width of the screenshot viewport
   * @default 1920
   */
  width?: number;

  /**
   * Height of the screenshot viewport
   * @default 1080
   */
  height?: number;

  /**
   * Wait time in milliseconds before taking screenshot
   * @default 2000
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
}

export interface ScreenshotResult {
  /**
   * Path to the screenshot file
   */
  filePath: string;

  /**
   * Screenshot buffer
   */
  buffer: Buffer;

  /**
   * Viewport size used
   */
  viewport: { width: number; height: number };
}

export class FoundryScreenshotService {
  private browser: Browser | null = null;

  /**
   * Initialize the browser instance
   */
  async initialize(): Promise<void> {
    if (this.browser) return;

    console.log('[FoundryScreenshot] Launching Chromium browser...');
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    console.log('[FoundryScreenshot] Browser launched successfully');
  }

  /**
   * Close the browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('[FoundryScreenshot] Browser closed');
    }
  }

  /**
   * Capture screenshot of Foundry VTT instance
   */
  async captureScreenshot(
    foundryUrl: string,
    options: ScreenshotOptions = {}
  ): Promise<ScreenshotResult> {
    // Ensure browser is initialized
    if (!this.browser) {
      await this.initialize();
    }

    if (!this.browser) {
      throw new Error('Failed to initialize browser');
    }

    // Set default options
    const width = options.width || 1920;
    const height = options.height || 1080;
    const waitTime = options.waitTime || 2000;
    const fullPage = options.fullPage || false;

    console.log(`[FoundryScreenshot] Capturing screenshot of ${foundryUrl}`);

    // Create new page
    const page: Page = await this.browser.newPage({
      viewport: { width, height },
    });

    try {
      // Navigate to Foundry URL
      await page.goto(foundryUrl, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Wait for Foundry to load
      await page.waitForTimeout(waitTime);

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
      const filename = `foundry-${randomBytes(8).toString('hex')}.png`;
      const filePath = join(tmpdir(), filename);

      // Save to file
      await writeFile(filePath, screenshotBuffer);

      console.log(`[FoundryScreenshot] Screenshot saved to ${filePath}`);

      return {
        filePath,
        buffer: screenshotBuffer,
        viewport: { width, height },
      };
    } finally {
      // Close page
      await page.close();
    }
  }

  /**
   * Capture screenshot of Foundry canvas (game board)
   */
  async captureCanvas(
    foundryUrl: string,
    options: ScreenshotOptions = {}
  ): Promise<ScreenshotResult> {
    return this.captureScreenshot(foundryUrl, {
      ...options,
      selector: '#board', // Foundry's main canvas element
    });
  }

  /**
   * Capture screenshot of Foundry sidebar
   */
  async captureSidebar(
    foundryUrl: string,
    options: ScreenshotOptions = {}
  ): Promise<ScreenshotResult> {
    return this.captureScreenshot(foundryUrl, {
      ...options,
      selector: '#sidebar', // Foundry's sidebar element
    });
  }
}

// Singleton instance
let screenshotService: FoundryScreenshotService | null = null;

/**
 * Get or create the screenshot service instance
 */
export function getScreenshotService(): FoundryScreenshotService {
  if (!screenshotService) {
    screenshotService = new FoundryScreenshotService();
  }
  return screenshotService;
}

/**
 * Clean up screenshot service on process exit
 */
process.on('exit', async () => {
  if (screenshotService) {
    await screenshotService.close();
  }
});

process.on('SIGINT', async () => {
  if (screenshotService) {
    await screenshotService.close();
  }
  process.exit(0);
});
