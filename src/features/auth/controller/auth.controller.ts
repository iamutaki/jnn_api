import type { Context } from 'hono'
import { response } from '../../../lib/response'
import { authService } from '../service/auth.service'

export const authController = {
  login: async (c: Context) => {
    try {
      const body = await c.req.json()
      const result = await authService.login(body)
      return response.success(c, result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      return response.error(c, message, 401)
    }
  },
}
