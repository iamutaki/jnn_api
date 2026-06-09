import type { Context, Next } from 'hono'
import { jwtUtil } from '../lib/jwt'

/**
 * Auth middleware — validates Bearer token on protected routes.
 *
 * Flow:
 * 1. Extract "Authorization: Bearer <token>" header
 * 2. Verify JWT signature + expiration
 * 3. Attach decoded payload to `c.set('user', ...)` for downstream handlers
 */
export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Missing or invalid authorization header' }, 401)
  }

  const token = authHeader.replace('Bearer ', '')

  try {
    const payload = await jwtUtil.verify(token)
    c.set('user', payload)
    await next()
  } catch {
    return c.json({ success: false, error: 'Invalid or expired token' }, 401)
  }
}
