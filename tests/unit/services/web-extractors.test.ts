/**
 * Web Content Extractors Tests
 * Tests for site-specific content extraction
 */

import { describe, it, expect } from 'vitest';
import { extractContent, type SiteType } from '../../../src/services/web/extractors.js';

describe('Web Content Extractors', () => {
  describe('extractContent', () => {
    it('should route to correct extractor based on site type', () => {
      const html = '<html><body><p>Test content</p></body></html>';
      const url = 'https://example.com';

      const siteTypes: SiteType[] = ['5etools', 'dndbeyond', 'foundryvtt', 'cypher', 'general'];

      siteTypes.forEach((siteType) => {
        const result = extractContent(html, url, siteType);
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('content');
      });
    });
  });

  describe('5e.tools extraction', () => {
    it('should extract title from URL hash', () => {
      const html = '<html><head><title>5e.tools</title></head><body><p>Content</p></body></html>';
      const url = 'https://5e.tools/spells.html#fireball';

      const result = extractContent(html, url, '5etools');

      expect(result.title).toContain('Fireball');
      expect(result.title).toContain('5e.tools');
    });

    it('should handle URL-encoded hash', () => {
      const html = '<html><head><title>5e.tools</title></head><body><p>Content</p></body></html>';
      const url = 'https://5e.tools/spells.html#magic_missile';

      const result = extractContent(html, url, '5etools');

      // Title is capitalized from the hash (first letter uppercase)
      expect(result.title.toLowerCase()).toContain('magic missile');
    });

    it('should provide fallback for JS-rendered content', () => {
      const html = '<html><head><title>5e.tools</title></head><body></body></html>';
      const url = 'https://5e.tools/spells.html#fireball';

      const result = extractContent(html, url, '5etools');

      expect(result.content).toContain('JavaScript rendering');
      expect(result.content).toContain(url);
    });

    it('should include site metadata', () => {
      const html = '<html><head><title>5e.tools</title></head><body><p>Content</p></body></html>';
      const url = 'https://5e.tools/spells.html#fireball';

      const result = extractContent(html, url, '5etools');

      expect(result.metadata?.site).toBe('5e.tools');
      expect(result.metadata?.category).toBe('spells');
    });

    it('should detect category from URL', () => {
      const html = '<html><head><title>5e.tools</title></head><body></body></html>';

      const testCases = [
        { url: 'https://5e.tools/spells.html', expected: 'spells' },
        { url: 'https://5e.tools/bestiary.html', expected: 'monsters' },
        { url: 'https://5e.tools/items.html', expected: 'items' },
        { url: 'https://5e.tools/classes.html', expected: 'classes' },
        { url: 'https://5e.tools/races.html', expected: 'races' },
        { url: 'https://5e.tools/feats.html', expected: 'feats' },
        { url: 'https://5e.tools/backgrounds.html', expected: 'backgrounds' },
        { url: 'https://5e.tools/conditions.html', expected: 'conditions' },
        { url: 'https://5e.tools/rules.html', expected: 'rules' },
        { url: 'https://5e.tools/unknown.html', expected: 'general' },
      ];

      testCases.forEach(({ url, expected }) => {
        const result = extractContent(html, url, '5etools');
        expect(result.metadata?.category).toBe(expected);
      });
    });

    it('should truncate long content', () => {
      const longContent = 'x'.repeat(5000);
      const html = `<html><head><title>5e.tools</title></head><body><p>${longContent}</p></body></html>`;
      const url = 'https://5e.tools/spells.html';

      const result = extractContent(html, url, '5etools');

      expect(result.content.length).toBeLessThan(5000);
      expect(result.content).toContain('[Content truncated');
    });
  });

  describe('D&D Beyond extraction', () => {
    it('should extract title from page', () => {
      const html =
        '<html><head><title>Fireball - D&D Beyond</title></head><body><p>Content</p></body></html>';
      const url = 'https://www.dndbeyond.com/spells/fireball';

      const result = extractContent(html, url, 'dndbeyond');

      expect(result.title).toBe('Fireball');
    });

    it('should extract content from spell-details div', () => {
      const html = `
        <html>
        <head><title>Fireball - D&D Beyond</title></head>
        <body>
          <div class="spell-details">
            <p>A bright streak flashes from your pointing finger...</p>
          </div>
        </body>
        </html>
      `;
      const url = 'https://www.dndbeyond.com/spells/fireball';

      const result = extractContent(html, url, 'dndbeyond');

      expect(result.content).toContain('bright streak');
    });

    it('should extract content from article tag', () => {
      const html = `
        <html>
        <head><title>Test - D&D Beyond</title></head>
        <body>
          <article>
            <p>Article content here</p>
          </article>
        </body>
        </html>
      `;
      const url = 'https://www.dndbeyond.com/test';

      const result = extractContent(html, url, 'dndbeyond');

      expect(result.content).toContain('Article content');
    });

    it('should include site metadata', () => {
      const html = '<html><head><title>Test</title></head><body></body></html>';
      const url = 'https://www.dndbeyond.com/test';

      const result = extractContent(html, url, 'dndbeyond');

      expect(result.metadata?.site).toBe('D&D Beyond');
    });
  });

  describe('FoundryVTT KB extraction', () => {
    it('should extract title and clean it', () => {
      const html =
        '<html><head><title>Actors | Foundry Virtual Tabletop</title></head><body></body></html>';
      const url = 'https://foundryvtt.com/kb/actors';

      const result = extractContent(html, url, 'foundryvtt');

      expect(result.title).toBe('Actors');
    });

    it('should extract article content', () => {
      const html = `
        <html>
        <head><title>Test - FoundryVTT</title></head>
        <body>
          <article class="article">
            <h1>API Documentation</h1>
            <p>This is the documentation content.</p>
          </article>
        </body>
        </html>
      `;
      const url = 'https://foundryvtt.com/kb/api';

      const result = extractContent(html, url, 'foundryvtt');

      expect(result.content).toContain('API Documentation');
      expect(result.content).toContain('documentation content');
    });

    it('should include knowledge-base category', () => {
      const html = '<html><head><title>Test</title></head><body></body></html>';
      const url = 'https://foundryvtt.com/kb/test';

      const result = extractContent(html, url, 'foundryvtt');

      expect(result.metadata?.site).toBe('FoundryVTT');
      expect(result.metadata?.category).toBe('knowledge-base');
    });
  });

  describe('Cypher System extraction', () => {
    it('should extract title', () => {
      const html = '<html><head><title>Cypher System SRD</title></head><body></body></html>';
      const url = 'https://cypher.example.com';

      const result = extractContent(html, url, 'cypher');

      expect(result.title).toBe('Cypher System SRD');
    });

    it('should extract content from content div', () => {
      const html = `
        <html>
        <head><title>Warrior Type</title></head>
        <body>
          <div class="content">
            <h2>Warrior</h2>
            <p>Warriors are combat specialists...</p>
          </div>
        </body>
        </html>
      `;
      const url = 'https://cypher.example.com/types/warrior';

      const result = extractContent(html, url, 'cypher');

      expect(result.content).toContain('Warrior');
      expect(result.content).toContain('combat specialists');
    });

    it('should include site metadata', () => {
      const html = '<html><head><title>Test</title></head><body></body></html>';
      const url = 'https://cypher.example.com';

      const result = extractContent(html, url, 'cypher');

      expect(result.metadata?.site).toBe('Cypher System Tools');
    });
  });

  describe('General extraction', () => {
    it('should extract title from HTML', () => {
      const html = '<html><head><title>My Website</title></head><body></body></html>';
      const url = 'https://example.com/page';

      const result = extractContent(html, url, 'general');

      expect(result.title).toBe('My Website');
    });

    it('should use hostname as fallback title', () => {
      const html = '<html><head></head><body></body></html>';
      const url = 'https://example.com/page';

      const result = extractContent(html, url, 'general');

      expect(result.title).toBe('example.com');
    });

    it('should extract content from article tag', () => {
      const html = `
        <html>
        <head><title>Test</title></head>
        <body>
          <article>
            <p>Main article content here</p>
          </article>
        </body>
        </html>
      `;
      const url = 'https://example.com';

      const result = extractContent(html, url, 'general');

      expect(result.content).toContain('Main article content');
    });

    it('should extract content from main tag', () => {
      const html = `
        <html>
        <head><title>Test</title></head>
        <body>
          <main>
            <p>Main content area</p>
          </main>
        </body>
        </html>
      `;
      const url = 'https://example.com';

      const result = extractContent(html, url, 'general');

      expect(result.content).toContain('Main content area');
    });

    it('should extract content from content div', () => {
      const html = `
        <html>
        <head><title>Test</title></head>
        <body>
          <div class="content">
            <p>Div content here</p>
          </div>
        </body>
        </html>
      `;
      const url = 'https://example.com';

      const result = extractContent(html, url, 'general');

      expect(result.content).toContain('Div content');
    });

    it('should fallback to body content', () => {
      const html = `
        <html>
        <head><title>Test</title></head>
        <body>
          <p>Body paragraph content</p>
        </body>
        </html>
      `;
      const url = 'https://example.com';

      const result = extractContent(html, url, 'general');

      expect(result.content).toContain('Body paragraph');
    });

    it('should include source URL in content', () => {
      const html = '<html><head><title>Test</title></head><body><p>Content</p></body></html>';
      const url = 'https://example.com/page';

      const result = extractContent(html, url, 'general');

      expect(result.content).toContain('Source: https://example.com/page');
    });
  });

  describe('HTML to text conversion', () => {
    it('should remove script tags', () => {
      const html = `
        <html>
        <head><title>Test</title></head>
        <body>
          <script>alert('bad');</script>
          <p>Good content</p>
        </body>
        </html>
      `;
      const url = 'https://example.com';

      const result = extractContent(html, url, 'general');

      expect(result.content).not.toContain('alert');
      expect(result.content).toContain('Good content');
    });

    it('should remove style tags', () => {
      const html = `
        <html>
        <head><title>Test</title></head>
        <body>
          <style>.bad { color: red; }</style>
          <p>Good content</p>
        </body>
        </html>
      `;
      const url = 'https://example.com';

      const result = extractContent(html, url, 'general');

      expect(result.content).not.toContain('color: red');
      expect(result.content).toContain('Good content');
    });

    it('should convert headers to markdown', () => {
      const html = `
        <html>
        <head><title>Test</title></head>
        <body>
          <h1>Header 1</h1>
          <h2>Header 2</h2>
          <h3>Header 3</h3>
        </body>
        </html>
      `;
      const url = 'https://example.com';

      const result = extractContent(html, url, 'general');

      expect(result.content).toContain('# Header 1');
      expect(result.content).toContain('## Header 2');
      expect(result.content).toContain('### Header 3');
    });

    it('should convert lists to markdown', () => {
      const html = `
        <html>
        <head><title>Test</title></head>
        <body>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </body>
        </html>
      `;
      const url = 'https://example.com';

      const result = extractContent(html, url, 'general');

      expect(result.content).toContain('- Item 1');
      expect(result.content).toContain('- Item 2');
    });

    it('should convert bold and italic', () => {
      const html = `
        <html>
        <head><title>Test</title></head>
        <body>
          <p><strong>Bold text</strong> and <em>italic text</em></p>
        </body>
        </html>
      `;
      const url = 'https://example.com';

      const result = extractContent(html, url, 'general');

      expect(result.content).toContain('**Bold text**');
      expect(result.content).toContain('*italic text*');
    });

    it('should convert links', () => {
      const html = `
        <html>
        <head><title>Test</title></head>
        <body>
          <p><a href="https://example.com">Link text</a></p>
        </body>
        </html>
      `;
      const url = 'https://example.com';

      const result = extractContent(html, url, 'general');

      expect(result.content).toContain('Link text');
      expect(result.content).toContain('(https://example.com)');
    });

    it('should decode HTML entities', () => {
      const html = `
        <html>
        <head><title>Test</title></head>
        <body>
          <p>&amp; &lt; &gt; &quot; &nbsp; &mdash; &ndash; &hellip;</p>
        </body>
        </html>
      `;
      const url = 'https://example.com';

      const result = extractContent(html, url, 'general');

      expect(result.content).toContain('&');
      expect(result.content).toContain('<');
      expect(result.content).toContain('>');
      expect(result.content).toContain('"');
      expect(result.content).toContain('—');
      expect(result.content).toContain('–');
      expect(result.content).toContain('...');
    });

    it('should remove HTML comments', () => {
      const html = `
        <html>
        <head><title>Test</title></head>
        <body>
          <!-- This is a comment -->
          <p>Visible content</p>
        </body>
        </html>
      `;
      const url = 'https://example.com';

      const result = extractContent(html, url, 'general');

      expect(result.content).not.toContain('This is a comment');
      expect(result.content).toContain('Visible content');
    });

    it('should handle horizontal rules', () => {
      const html = `
        <html>
        <head><title>Test</title></head>
        <body>
          <p>Before</p>
          <hr>
          <p>After</p>
        </body>
        </html>
      `;
      const url = 'https://example.com';

      const result = extractContent(html, url, 'general');

      expect(result.content).toContain('---');
    });

    it('should clean up excessive whitespace', () => {
      const html = `
        <html>
        <head><title>Test</title></head>
        <body>
          <p>Text   with    lots     of      spaces</p>
        </body>
        </html>
      `;
      const url = 'https://example.com';

      const result = extractContent(html, url, 'general');

      expect(result.content).not.toContain('     ');
    });
  });

  describe('Content truncation', () => {
    it('should truncate content over 4000 characters', () => {
      const longText = 'x'.repeat(5000);
      const html = `<html><head><title>Test</title></head><body><p>${longText}</p></body></html>`;
      const url = 'https://example.com';

      const result = extractContent(html, url, 'general');

      expect(result.content.length).toBeLessThan(5000);
      expect(result.content).toContain('[Content truncated');
    });

    it('should not truncate content under 4000 characters', () => {
      const shortText = 'x'.repeat(100);
      const html = `<html><head><title>Test</title></head><body><p>${shortText}</p></body></html>`;
      const url = 'https://example.com';

      const result = extractContent(html, url, 'general');

      expect(result.content).not.toContain('[Content truncated');
    });
  });
});
