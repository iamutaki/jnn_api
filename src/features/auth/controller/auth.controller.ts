import type { Context } from 'hono'
import { response } from '../../../lib/response'
import { safeJsonBody } from '../../../lib/request'
import { validate } from '../../../lib/validation'
import type { Env } from '../../../types'
import { authService } from '../service/auth.service'

const LOGIN_SCHEMA = {
  username: { required: true, type: 'string' as const, minLength: 1 },
  password: { required: true, type: 'string' as const, minLength: 1 },
}

const REFRESH_SCHEMA = {
  refreshToken: { required: true, type: 'string' as const, minLength: 1 },
}

export const authController = {
  login: async (c: Context<Env>) => {
    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, LOGIN_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'AUTH_VALIDATION_ERROR')
    }

    try {
      const data = await authService.login(c.env.DB, result.body as any, c.env.TOKEN_SECRET)
      return response.success(c, data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      return response.error(c, message, 401, 'AUTH_LOGIN_FAILED')
    }
  },

  refresh: async (c: Context<Env>) => {
    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, REFRESH_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'AUTH_VALIDATION_ERROR')
    }

    try {
      const data = await authService.refresh(c.env.DB, result.body as any, c.env.TOKEN_SECRET)
      return response.success(c, data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Refresh failed'
      return response.error(c, message, 401, 'AUTH_REFRESH_FAILED')
    }
  },
}
