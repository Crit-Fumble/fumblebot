/**
 * CORS Middleware for Discord Activity and Multi-Platform Support
 *
 * Configures Cross-Origin Resource Sharing for:
 * - Discord Activity iframe embedding
 * - Discord SDK communication
 * - Custom web platforms
 */

import type { Request, Response, NextFunction, Application } from 'express';

export interface CorsConfig {
  /** Discord Application Client ID (for discordsays.com origin) */
  discordClientId: string;
  /** Additional allowed origins */
  additionalOrigins?: string[];
  /** Whether to include localhost origins (for development) */
  allowLocalhost?: boolean;
}

/**
 * Build the list of allowed origins based on configuration
 */
export function buildAllowedOrigins(config: CorsConfig): string[] {
  const origins: string[] = [
    // Discord core domains
    'https://discord.com',
    'https://discordsays.com',
    // Discord Activity SDK domain (uses client ID)
    `https://${config.discordClientId}.discordsays.com`,
  ];

  // Add additional custom origins
  if (config.additionalOrigins) {
    origins.push(...config.additionalOrigins);
  }

  // Add localhost origins for development
  if (config.allowLocalhost) {
    origins.push(
      'http://localhost:3000',
      'http://localhost:5173', // Vite dev server
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    );
  }

  return origins;
}

/**
 * Check if an origin is allowed
 */
export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) return false;

  return allowedOrigins.some((allowed) => {
    // Exact match
    if (origin === allowed) return true;
    // Wildcard subdomain match (e.g., https://*.discordsays.com)
    if (allowed.includes('*')) {
      const pattern = allowed.replace('*', '.*');
      return new RegExp(`^${pattern}$`).test(origin);
    }
    return false;
  });
}

/**
 * Create CORS middleware for Discord Activity and web platforms
 */
export function createCorsMiddleware(config: CorsConfig) {
  const allowedOrigins = buildAllowedOrigins(config);

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (origin && isOriginAllowed(origin, allowedOrigins)) {
      res.header('Access-Control-Allow-Origin', origin);
    } else if (origin) {
      // Default to discord.com for unrecognized origins
      // This maintains compatibility while being secure
      res.header('Access-Control-Allow-Origin', 'https://discord.com');
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Discord-User-Id');
    res.header('Access-Control-Allow-Credentials', 'true');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  };
}

/**
 * Setup CORS on an Express application
 */
export function setupCors(app: Application, config: CorsConfig): void {
  app.use(createCorsMiddleware(config));
}
