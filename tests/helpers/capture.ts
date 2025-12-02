/**
 * Test Capture Helpers
 *
 * Utilities for capturing screenshots and API request/response data during tests
 */

import { Page, APIResponse, APIRequestContext } from '@playwright/test'
import { writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'

export interface CaptureOptions {
  name: string
  testName?: string
  timestamp?: boolean
}

export interface APICapture {
  timestamp: string
  testName: string
  request: {
    url: string
    method: string
    headers: Record<string, string>
    body?: any
  }
  response: {
    status: number
    statusText: string
    headers: Record<string, string>
    body: any
    timing: {
      duration: number
    }
  }
}

/**
 * Capture a screenshot and save it to tests/output/screenshots
 */
export async function captureScreenshot(
  page: Page,
  options: CaptureOptions
): Promise<string> {
  const timestamp = options.timestamp !== false ? `-${Date.now()}` : ''
  const testPath = options.testName
    ? options.testName.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    : 'screenshot'
  const filename = `${testPath}-${options.name}${timestamp}.png`
  const filepath = join('tests', 'output', 'screenshots', filename)

  // Ensure directory exists
  await mkdir(dirname(filepath), { recursive: true })

  // Capture screenshot
  await page.screenshot({
    path: filepath,
    fullPage: true,
  })

  return filepath
}

/**
 * Capture API request and response data
 */
export async function captureAPICall(
  response: APIResponse,
  options: CaptureOptions,
  requestInfo?: { method?: string; url?: string; headers?: Record<string, string>; body?: any }
): Promise<string> {
  const timestamp = options.timestamp !== false ? `-${Date.now()}` : ''
  const testPath = options.testName
    ? options.testName.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    : 'api-call'
  const filename = `${testPath}-${options.name}${timestamp}.json`
  const filepath = join('tests', 'output', 'data', filename)

  // Ensure directory exists
  await mkdir(dirname(filepath), { recursive: true })

  // Extract response details
  const responseHeaders: Record<string, string> = {}
  const responseAllHeaders = response.headers()
  Object.entries(responseAllHeaders).forEach(([key, value]) => {
    responseHeaders[key] = String(value)
  })

  // Parse response body
  let responseBody: any
  try {
    const contentType = responseHeaders['content-type'] || ''
    if (contentType.includes('application/json')) {
      responseBody = await response.json()
    } else {
      responseBody = await response.text()
    }
  } catch (error) {
    responseBody = null
  }

  // Build capture object
  const capture: APICapture = {
    timestamp: new Date().toISOString(),
    testName: options.testName || 'unknown',
    request: {
      url: requestInfo?.url || response.url(),
      method: requestInfo?.method || 'GET',
      headers: requestInfo?.headers || {},
      body: requestInfo?.body,
    },
    response: {
      status: response.status(),
      statusText: response.statusText(),
      headers: responseHeaders,
      body: responseBody,
      timing: {
        duration: 0, // Playwright doesn't expose timing directly
      },
    },
  }

  // Save to file
  await writeFile(filepath, JSON.stringify(capture, null, 2), 'utf-8')

  return filepath
}

/**
 * Create a wrapped request context that automatically captures all API calls
 */
export function createCapturingRequest(
  request: APIRequestContext,
  testName: string
) {
  return {
    async get(url: string, options?: any) {
      const response = await request.get(url, options)
      const urlObj = new URL(url)
      await captureAPICall(
        response,
        {
          name: `get-${urlObj.pathname.replace(/\//g, '-')}`,
          testName,
          timestamp: true,
        },
        {
          method: 'GET',
          url,
          headers: options?.headers || {},
          body: options?.data,
        }
      )
      return response
    },
    async post(url: string, options?: any) {
      const response = await request.post(url, options)
      const urlObj = new URL(url)
      await captureAPICall(
        response,
        {
          name: `post-${urlObj.pathname.replace(/\//g, '-')}`,
          testName,
          timestamp: true,
        },
        {
          method: 'POST',
          url,
          headers: options?.headers || {},
          body: options?.data,
        }
      )
      return response
    },
    async put(url: string, options?: any) {
      const response = await request.put(url, options)
      const urlObj = new URL(url)
      await captureAPICall(
        response,
        {
          name: `put-${urlObj.pathname.replace(/\//g, '-')}`,
          testName,
          timestamp: true,
        },
        {
          method: 'PUT',
          url,
          headers: options?.headers || {},
          body: options?.data,
        }
      )
      return response
    },
    async delete(url: string, options?: any) {
      const response = await request.delete(url, options)
      const urlObj = new URL(url)
      await captureAPICall(
        response,
        {
          name: `delete-${urlObj.pathname.replace(/\//g, '-')}`,
          testName,
          timestamp: true,
        },
        {
          method: 'DELETE',
          url,
          headers: options?.headers || {},
          body: options?.data,
        }
      )
      return response
    },
    async patch(url: string, options?: any) {
      const response = await request.patch(url, options)
      const urlObj = new URL(url)
      await captureAPICall(
        response,
        {
          name: `patch-${urlObj.pathname.replace(/\//g, '-')}`,
          testName,
          timestamp: true,
        },
        {
          method: 'PATCH',
          url,
          headers: options?.headers || {},
          body: options?.data,
        }
      )
      return response
    },
  }
}
