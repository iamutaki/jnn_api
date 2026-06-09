import { jwtUtil } from '../../../lib/jwt'
import type { LoginRequest, LoginResponse } from '../auth.types'

/**
 * Static credentials for prototype.
 * In production, replace with database lookup + bcrypt hash comparison.
 */
interface StaticUser {
  name: string
  password: string
  roles: string[]
}

const STATIC_USERS: Record<string, StaticUser> = {
  developer: {
    name: 'Developer',
    password: 'password',
    roles: ['admin', 'user'],
  },
}

export const authService = {
  login: async (body: LoginRequest, jwtSecret: string): Promise<LoginResponse> => {
    const { username, password } = body

    if (!username || !password) {
      throw new Error('Username and password are required')
    }

    const user = STATIC_USERS[username]

    if (!user || user.password !== password) {
      throw new Error('Invalid username or password')
    }

    const [accessToken, refreshToken] = await Promise.all([
      jwtUtil.signAccess({ sub: username }, jwtSecret),
      jwtUtil.signRefresh({ sub: username }, jwtSecret),
    ])

    return {
      accessToken,
      refreshToken,
      user: {
        name: user.name,
        username,
        roles: user.roles,
      },
    }
  },
}
