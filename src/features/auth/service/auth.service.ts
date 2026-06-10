import { tokenUtil } from '../../../lib/token'
import { verifyPassword } from '../../../lib/password'
import type { LoginRequest, LoginResponse, RefreshRequest } from '../auth.types'

export const authService = {
  login: async (db: D1Database, body: LoginRequest, secret: string): Promise<LoginResponse> => {
    const { username, password } = body

    const user = await db
      .prepare('SELECT id, username, password, name FROM users WHERE username = ?')
      .bind(username)
      .first<{ id: string; username: string; password: string; name: string }>()

    if (!user || !(await verifyPassword(password, user.password))) {
      throw new Error('Invalid username or password')
    }

    const [accessToken, refreshToken] = await Promise.all([
      Promise.resolve(tokenUtil.signAccess({ sub: username, userId: user.id }, secret)),
      Promise.resolve(tokenUtil.signRefresh({ sub: username, userId: user.id }, secret)),
    ])

    return { accessToken, refreshToken }
  },

  refresh: async (db: D1Database, body: RefreshRequest, secret: string): Promise<LoginResponse> => {
    let payload: { sub: string; userId: string }
    try {
      payload = tokenUtil.verify(body.refreshToken, secret)
    } catch {
      throw new Error('Invalid or expired refresh token')
    }

    const user = await db
      .prepare('SELECT id, username FROM users WHERE username = ?')
      .bind(payload.sub)
      .first<{ id: string; username: string }>()

    if (!user) {
      throw new Error('User not found')
    }

    const [accessToken, refreshToken] = await Promise.all([
      Promise.resolve(tokenUtil.signAccess({ sub: payload.sub, userId: user.id }, secret)),
      Promise.resolve(tokenUtil.signRefresh({ sub: payload.sub, userId: user.id }, secret)),
    ])

    return { accessToken, refreshToken }
  },
}
