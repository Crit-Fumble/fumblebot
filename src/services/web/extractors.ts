/**
 * Site-Specific Content Extractors
 * Extracts meaningful content from TTRPG websites
 */

/** Supported site types */
export type SiteType = '5etools' | 'dndbeyond' | 'foundryvtt' | 'cypher' | 'general';

/** Extracted content result */
export interface ExtractedContent {
  title: string;
  content: string;
  metadata?: Record<string, string>;
}

/**
 * Extract content from HTML based on site type
 */
export function extractContent(
  html: string,
  url: string,
  siteType: SiteType,
  query?: string
): ExtractedContent {
  switch (siteType) {
    case '5etools':
      return extract5eTools(html, url, query);
    case 'dndbeyond':
      return extractDndBeyond(html, url, query);
    case 'foundryvtt':
      return extractFoundryVTT(html, url, query);
    case 'cypher':
      return extractCypher(html, url, query);
    default:
      return extractGeneral(html, url, query);
  }
}

/**
 * Extract content from 5e.tools
 * 5e.tools uses JavaScript rendering, so we extract from data attributes and scripts
 */
function extract5eTools(html: string, url: string, query?: string): ExtractedContent {
  // Extract title from URL hash or page title
  const hashMatch = url.match(/#(.+)$/);
  const titleFromHash = hashMatch ? decodeURIComponent(hashMatch[1]).replace(/_/g, ' ') : null;

  // Try to extract title from HTML
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const pageTitle = titleMatch ? cleanText(titleMatch[1]) : '5e.tools';

  const title = titleFromHash
    ? `${capitalize(titleFromHash)} - ${pageTitle}`
    : pageTitle;

  // 5e.tools loads content dynamically, extract what we can from the HTML
  // Look for stat blocks and content divs
  let content = '';

  // Extract any visible text content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    content = htmlToText(bodyMatch[1]);
  }

  // If content is too short (JS-rendered), provide guidance
  if (content.length < 100) {
    content = `Content from 5e.tools for "${titleFromHash || query || 'unknown'}". ` +
      `The page uses JavaScript rendering. For full details, visit: ${url}`;
  }

  // Truncate if too long
  if (content.length > 4000) {
    content = content.substring(0, 4000) + '...\n\n[Content truncated. See full details at source.]';
  }

  return {
    title,
    content: content + `\n\nSource: ${url}`,
    metadata: {
      site: '5e.tools',
      category: getCategoryFromUrl(url),
    },
  };
}

/**
 * Extract content from D&D Beyond
 */
function extractDndBeyond(html: string, url: string, query?: string): ExtractedContent {
  // Extract title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? cleanText(titleMatch[1]).replace(' - D&D Beyond', '') : 'D&D Beyond';

  // Try to extract main content area
  let content = '';

  // Look for spell/item/monster content
  const contentPatterns = [
    /<div[^>]*class="[^"]*spell-details[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*item-details[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*monster-details[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*content-container[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    /<main[^>]*>([\s\S]*?)<\/main>/gi,
  ];

  for (const pattern of contentPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const extracted = htmlToText(match[1]);
      if (extracted.length > content.length) {
        content = extracted;
      }
    }
  }

  // Fallback to body content
  if (!content || content.length < 50) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      content = htmlToText(bodyMatch[1]);
    }
  }

  // Clean up and truncate
  content = content.trim();
  if (content.length > 4000) {
    content = content.substring(0, 4000) + '...\n\n[Content truncated. See full details at source.]';
  }

  return {
    title,
    content: content + `\n\nSource: ${url}`,
    metadata: {
      site: 'D&D Beyond',
    },
  };
}

/**
 * Extract content from FoundryVTT Knowledge Base
 */
function extractFoundryVTT(html: string, url: string, query?: string): ExtractedContent {
  // Extract title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch
    ? cleanText(titleMatch[1]).replace(' | Foundry Virtual Tabletop', '').replace(' - FoundryVTT', '')
    : 'FoundryVTT KB';

  // FoundryVTT KB has good semantic HTML
  let content = '';

  // Look for article content
  const articlePatterns = [
    /<article[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/article>/gi,
    /<div[^>]*class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*kb-content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<main[^>]*>([\s\S]*?)<\/main>/gi,
  ];

  for (const pattern of articlePatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const extracted = htmlToText(match[1]);
      if (extracted.length > content.length) {
        content = extracted;
      }
    }
  }

  // Fallback
  if (!content || content.length < 50) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      content = htmlToText(bodyMatch[1]);
    }
  }

  // Truncate
  if (content.length > 4000) {
    content = content.substring(0, 4000) + '...\n\n[Content truncated. See full details at source.]';
  }

  return {
    title,
    content: content + `\n\nSource: ${url}`,
    metadata: {
      site: 'FoundryVTT',
      category: 'knowledge-base',
    },
  };
}

/**
 * Extract content from Cypher System tools
 */
function extractCypher(html: string, url: string, query?: string): ExtractedContent {
  // Extract title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? cleanText(titleMatch[1]) : 'Cypher System Tools';

  // Look for main content
  let content = '';

  const contentPatterns = [
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*character[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<main[^>]*>([\s\S]*?)<\/main>/gi,
  ];

  for (const pattern of contentPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const extracted = htmlToText(match[1]);
      if (extracted.length > content.length) {
        content = extracted;
      }
    }
  }

  // Fallback
  if (!content || content.length < 50) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      content = htmlToText(bodyMatch[1]);
    }
  }

  // Truncate
  if (content.length > 4000) {
    content = content.substring(0, 4000) + '...\n\n[Content truncated. See full details at source.]';
  }

  return {
    title,
    content: content + `\n\nSource: ${url}`,
    metadata: {
      site: 'Cypher System Tools',
    },
  };
}

/**
 * Generic content extraction
 */
function extractGeneral(html: string, url: string, query?: string): ExtractedContent {
  // Extract title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? cleanText(titleMatch[1]) : new URL(url).hostname;

  // Try common content containers
  let content = '';

  const contentPatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    /<main[^>]*>([\s\S]*?)<\/main>/gi,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*id="content"[^>]*>([\s\S]*?)<\/div>/gi,
  ];

  for (const pattern of contentPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const extracted = htmlToText(match[1]);
      if (extracted.length > content.length) {
        content = extracted;
      }
    }
  }

  // Fallback to body
  if (!content || content.length < 50) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      content = htmlToText(bodyMatch[1]);
    }
  }

  // Truncate
  if (content.length > 4000) {
    content = content.substring(0, 4000) + '...\n\n[Content truncated. See full details at source.]';
  }

  return {
    title,
    content: content + `\n\nSource: ${url}`,
  };
}

/**
 * Convert HTML to plain text
 */
function htmlToText(html: string): string {
  return html
    // Remove script and style tags with content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Convert headers to markdown-style
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n')
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n')
    // Convert lists
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<\/ol>/gi, '\n')
    // Convert paragraphs and breaks
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    // Convert bold and italic
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, '**$2**')
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, '*$2*')
    // Convert links (keep text, add URL in parentheses)
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    // Convert tables to simple format
    .replace(/<th[^>]*>([\s\S]*?)<\/th>/gi, '| $1 ')
    .replace(/<td[^>]*>([\s\S]*?)<\/td>/gi, '| $1 ')
    .replace(/<\/tr>/gi, '|\n')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '...')
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Clean text (remove extra whitespace)
 */
function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Capitalize first letter
 */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Get category from 5e.tools URL
 */
function getCategoryFromUrl(url: string): string {
  const pathname = new URL(url).pathname.toLowerCase();

  if (pathname.includes('spells')) return 'spells';
  if (pathname.includes('bestiary')) return 'monsters';
  if (pathname.includes('items')) return 'items';
  if (pathname.includes('classes')) return 'classes';
  if (pathname.includes('races')) return 'races';
  if (pathname.includes('feats')) return 'feats';
  if (pathname.includes('backgrounds')) return 'backgrounds';
  if (pathname.includes('conditions')) return 'conditions';
  if (pathname.includes('rules')) return 'rules';

  return 'general';
}
