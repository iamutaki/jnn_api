import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * Standardized API response helpers.
 * Keeping response format consistent makes mobile client parsing easier.
 */
export const response = {
  success: <T>(c: Context, data: T, status: ContentfulStatusCode = 200) =>
    c.json(data, status),

  error: (c: Context, message: string, status: ContentfulStatusCode = 400) =>
    c.json({ error: message }, status),
}
