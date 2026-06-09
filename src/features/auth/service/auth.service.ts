import { jwtUtil } from '../../../lib/jwt'
import { verifyPassword } from '../../../lib/password'
import type { LoginRequest, LoginResponse } from '../auth.types'

export const authService = {
  login: async (db: D1Database, body: LoginRequest, jwtSecret: string): Promise<LoginResponse> => {
    const { username, password } = body

    const user = await db
      .prepare('SELECT id, username, password, name FROM users WHERE username = ?')
      .bind(username)
      .first<{ id: string; username: string; password: string; name: string }>()

    if (!user || !(await verifyPassword(password, user.password))) {
      throw new Error('Invalid username or password')
    }

    const roleRows = await db
      .prepare(`
        SELECT r.name
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = ?
      `)
      .bind(user.id)
      .all<{ name: string }>()

    const roles = roleRows.results.map((r) => r.name)

    const [accessToken, refreshToken] = await Promise.all([
      Promise.resolve(jwtUtil.signAccess({ sub: username }, jwtSecret)),
      Promise.resolve(jwtUtil.signRefresh({ sub: username }, jwtSecret)),
    ])

    return {
      accessToken,
      refreshToken,
    }
  },
}
