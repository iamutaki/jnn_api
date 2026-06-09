import type { Context } from 'hono'
import { response } from './response'

/**
 * Safely parse JSON body from request.
 * Returns null if body is empty or invalid JSON,
 * with proper 400 error response.
 */
export async function safeJsonBody(c: Context): Promise<Record<string, unknown> | Response> {
  try {
    const text = await c.req.text()
    if (!text || text.trim() === '') {
      return response.error(c, 'Request body is required', 400, 'VALIDATION_EMPTY_BODY')
    }
    return JSON.parse(text)
  } catch {
    return response.error(c, 'Invalid JSON body', 400, 'VALIDATION_INVALID_JSON')
  }
}
