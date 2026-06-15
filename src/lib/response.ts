import type { Context } from 'hono'
import type { StatusCode, ContentfulStatusCode } from 'hono/utils/http-status'
import { now } from './datetime'

interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface ErrorMeta {
  code: string
  timestamp: string
}

/**
 * Standardized API response helpers.
 *
 * All responses follow the same envelope:
 *
 *   Success:
 *     { success: true, data: ... }
 *
 *   Success + pagination:
 *     { success: true, data: [...], meta: { page, limit, total, totalPages } }
 *
 *   Error:
 *     { success: false, error: "message", meta: { code: "ERROR_CODE", timestamp: "..." } }
 */
export const response = {
  success: <T>(c: Context, data: T, status: ContentfulStatusCode = 200) =>
    c.json({ success: true as const, data }, status),

  noContent: (c: Context, status: StatusCode = 201) =>
    c.body(null, status),

  paginated: <T>(
    c: Context,
    data: T[],
    page: number,
    limit: number,
    total: number,
    status: ContentfulStatusCode = 200,
  ) =>
    c.json(
      {
        success: true as const,
        data,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        } satisfies PaginationMeta,
      },
      status,
    ),

  error: (
    c: Context,
    message: string,
    status: ContentfulStatusCode = 400,
    code = 'UNKNOWN_ERROR',
  ) =>
    c.json(
      {
        success: false as const,
        error: message,
        meta: {
          code,
          timestamp: now(),
        } satisfies ErrorMeta,
      },
      status,
    ),
}
