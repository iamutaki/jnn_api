import type { Context, Next } from 'hono'
import { tokenUtil } from '../lib/token'
import { response } from '../lib/response'
import type { Env } from '../types'

export const authMiddleware = async (c: Context<Env>, next: Next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return response.error(c, 'Missing or invalid authorization header', 401, 'AUTH_MISSING_TOKEN')
  }

  const token = authHeader.replace('Bearer ', '')

  try {
    const payload = tokenUtil.verify(token, c.env.TOKEN_SECRET)
    c.set('user', payload)
    await next()
  } catch {
    return response.error(c, 'Invalid or expired token', 401, 'AUTH_INVALID_TOKEN')
  }
}

export const requireRoles = (...roles: string[]) => {
  return async (c: Context<Env>, next: Next) => {
    const userId = c.get('user').userId
    const result = await c.env.DB
      .prepare(
        `SELECT r.name
           FROM user_roles ur
           JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = ?`,
      )
      .bind(userId)
      .all<{ name: string }>()

    const hasRole = result.results.some((r) => roles.includes(r.name))
    if (!hasRole) {
      return response.error(c, 'Akses ditolak', 403, 'FORBIDDEN')
    }

    await next()
  }
}
