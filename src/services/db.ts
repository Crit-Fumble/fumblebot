/**
 * Database Service
 *
 * FumbleBot Prisma database client and type exports.
 * Uses Prisma 7 with driver adapters for PostgreSQL.
 *
 * Supports VPC connections with CA certificate for secure internal connections.
 */

import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { PrismaPg } from '@prisma/adapter-pg';

// Dynamically require the Prisma client from node_modules/.prisma/fumblebot
const require = createRequire(import.meta.url);
const prismaModule = require('.prisma/fumblebot');

// Re-export everything from the generated Prisma client
export const Prisma = prismaModule.Prisma;
export const PrismaClient = prismaModule.PrismaClient as new (options?: { adapter: PrismaPg }) => PrismaClientType;

// Type for the Prisma client instance
type PrismaClientType = InstanceType<typeof prismaModule.PrismaClient>;

// Type the global for hot reloading in development
const globalForPrisma = globalThis as unknown as { fumblePrisma: PrismaClientType | undefined };

/**
 * Configuration options for creating a Prisma client.
 */
export interface FumbleBotDbConfig {
  /**
   * PostgreSQL connection string.
   * Takes priority over envVar if both are provided.
   */
  connectionString?: string;

  /**
   * Environment variable name to read the connection string from.
   * Only used if connectionString is not provided.
   */
  envVar?: string;

  /**
   * Path to CA certificate file for SSL connections.
   * If provided, enables SSL with the specified CA.
   */
  caCertPath?: string;

  /**
   * Environment variable name for CA certificate path.
   * Only used if caCertPath is not provided.
   */
  caCertEnvVar?: string;
}

/**
 * Resolve the database connection string from config.
 */
function resolveConnectionString(config: FumbleBotDbConfig): string {
  // Direct connection string takes priority
  if (config.connectionString) {
    return config.connectionString;
  }

  // Check env var by name
  if (config.envVar) {
    const connectionString = process.env[config.envVar];
    if (!connectionString) {
      throw new Error(
        `Database connection string not found in environment variable "${config.envVar}".`
      );
    }
    return connectionString;
  }

  throw new Error(
    'Database connection string required. Provide either connectionString or envVar in config.'
  );
}

/**
 * Resolve the CA certificate from config or environment.
 * Returns the certificate content as a string, or undefined if not configured.
 */
function resolveCaCertificate(config: FumbleBotDbConfig): string | undefined {
  // Direct path takes priority
  let certPath = config.caCertPath;

  // Check env var if no direct path
  if (!certPath && config.caCertEnvVar) {
    certPath = process.env[config.caCertEnvVar];
  }

  // Default to DATABASE_CA_CERT env var
  if (!certPath) {
    certPath = process.env.DATABASE_CA_CERT;
  }

  if (!certPath) {
    return undefined;
  }

  // Resolve relative paths from project root
  const resolvedPath = resolve(certPath);

  if (!existsSync(resolvedPath)) {
    console.warn(`[DB] CA certificate not found at: ${resolvedPath}`);
    return undefined;
  }

  try {
    const cert = readFileSync(resolvedPath, 'utf-8');
    console.log(`[DB] Loaded CA certificate from: ${resolvedPath}`);
    return cert;
  } catch (error) {
    console.error(`[DB] Failed to read CA certificate: ${error}`);
    return undefined;
  }
}

/**
 * Create a configured Prisma client instance.
 * Supports SSL with CA certificate for VPC connections.
 */
export function createPrismaClient(config: FumbleBotDbConfig): PrismaClientType {
  const connectionString = resolveConnectionString(config);
  const caCert = resolveCaCertificate(config);

  // Build adapter options
  const adapterOptions: { connectionString: string; ssl?: { ca: string; rejectUnauthorized: boolean } } = {
    connectionString,
  };

  // Add SSL config if CA certificate is available
  if (caCert) {
    adapterOptions.ssl = {
      ca: caCert,
      rejectUnauthorized: true, // Verify the server certificate
    };
    console.log('[DB] SSL enabled with CA certificate verification');
  }

  const adapter = new PrismaPg(adapterOptions);
  return new PrismaClient({ adapter });
}

/**
 * Initialize and cache a singleton Prisma client instance.
 * Uses global caching in development for hot reloading.
 */
export function initPrisma(config: FumbleBotDbConfig): PrismaClientType {
  if (globalForPrisma.fumblePrisma) {
    return globalForPrisma.fumblePrisma;
  }

  const client = createPrismaClient(config);

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.fumblePrisma = client;
  }

  return client;
}

// Singleton instance
let prismaInstance: PrismaClientType | null = null;

/**
 * Get the singleton Prisma client instance.
 * The client is lazily initialized on first call.
 */
export function getPrisma(): PrismaClientType {
  if (!prismaInstance) {
    prismaInstance = initPrisma({
      envVar: 'DATABASE_URL',
    });
  }
  return prismaInstance;
}

// Re-export all generated types
// NOTE: Campaign-related types (FumbleCampaign, FumbleCharacter, etc.) are now in @crit-fumble/core
export type {
  Guild,
  GuildMember,
  DiceRoll,
  Session,
  BotCommand,
  AuthUser,
  AuthSession,
  AuthAccount,
  ExpressSession,
  PromptPartial,
  PromptTargetType,
} from '.prisma/fumblebot';
