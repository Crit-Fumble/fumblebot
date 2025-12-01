/**
 * Core API Client
 * Singleton instance for accessing Core server APIs
 */

import { CoreApiClient } from '@crit-fumble/core/client'

let coreClient: CoreApiClient | null = null

/**
 * Get or create the Core API client singleton
 */
export function getCoreClient(): CoreApiClient {
  if (!coreClient) {
    const baseUrl = process.env.CORE_API_URL || 'https://core.crit-fumble.com'
    const apiKey = process.env.CORE_API_KEY

    if (!apiKey) {
      throw new Error('CORE_API_KEY environment variable is required')
    }

    coreClient = new CoreApiClient({
      baseUrl,
      apiKey,
      timeout: 30000,
    })
  }

  return coreClient
}

/**
 * Reset the client (useful for testing)
 */
export function resetCoreClient(): void {
  coreClient = null
}
