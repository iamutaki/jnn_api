import type { Context, Next } from 'hono'
import { jwtUtil } from '../lib/jwt'
import { response } from '../lib/response'
import type { Env } from '../types'

/**
 * Auth middleware — validates Bearer token on protected routes.
 *
 * Flow:
 * 1. Extract "Authorization: Bearer <token>" header
 * 2. Verify JWT signature + expiration using c.env.JWT_SECRET
 * 3. Attach decoded payload to `c.set('user', ...)` for downstream handlers
 */
export const authMiddleware = async (c: Context<Env>, next: Next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return response.error(c, 'Missing or invalid authorization header', 401, 'AUTH_MISSING_TOKEN')
  }

  const token = authHeader.replace('Bearer ', '')

  try {
    const payload = await jwtUtil.verify(token, c.env.JWT_SECRET)
    c.set('user', payload)
    await next()
  } catch {
    return response.error(c, 'Invalid or expired token', 401, 'AUTH_INVALID_TOKEN')
  }
}
