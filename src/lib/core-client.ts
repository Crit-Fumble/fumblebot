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
    // Use internal VPC URL if configured, otherwise public URL
    const serverUrl = process.env.CORE_SERVER_URL
    const serverPort = process.env.CORE_SERVER_PORT || '4000'
    const baseUrl = serverUrl
      ? (serverUrl.includes(':') ? serverUrl : `${serverUrl}:${serverPort}`)
      : 'https://core.crit-fumble.com'

    // Use CORE_SECRET for service-to-service auth
    const apiKey = process.env.CORE_SECRET

    if (!apiKey) {
      console.warn('[CoreClient] CORE_SECRET not set - some API calls may fail')
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
