/**
 * JWT utility for Hono running on Cloudflare Workers.
 *
 * Secret is injected via:
 *   Local:    .env → JWT_SECRET=xxx
 *   Remote:   wrangler secret put JWT_SECRET --env staging/production
 *
 * Accessed in code via c.env.JWT_SECRET, passed here as parameter.
 */
import { sign, verify } from 'hono/jwt'

export interface JwtPayload {
  sub: string // username
  iat: number
  exp: number
}

export const jwtUtil = {
  signAccess: (payload: { sub: string }, secret: string) =>
    sign(
      { sub: payload.sub, exp: Math.floor(Date.now() / 1000) + 60 * 60 }, // 1 hour
      secret,
      'HS256',
    ),

  signRefresh: (payload: { sub: string }, secret: string) =>
    sign(
      { sub: payload.sub, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }, // 7 days
      secret,
      'HS256',
    ),

  verify: (token: string, secret: string) =>
    verify(token, secret, 'HS256') as unknown as Promise<JwtPayload>,
}
