/**
 * JWT utility for Hono running on Cloudflare Workers.
 *
 * Cloudflare Workers don't have Node's `crypto` module,
 * but they DO have the Web Crypto API built-in.
 * Hono's built-in jwt helper wraps this nicely.
 */
import { sign, verify } from 'hono/jwt'

export interface JwtPayload {
  sub: string // username
  iat: number
  exp: number
}

// In production, this should come from Cloudflare secret/environment variable
const JWT_SECRET = 'jnn-prototype-secret-key-2024'

export const jwtUtil = {
  signAccess: (payload: { sub: string }) =>
    sign(
      { sub: payload.sub, exp: Math.floor(Date.now() / 1000) + 60 * 60 }, // 1 hour
      JWT_SECRET,
      'HS256',
    ),

  signRefresh: (payload: { sub: string }) =>
    sign(
      { sub: payload.sub, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }, // 7 days
      JWT_SECRET,
      'HS256',
    ),

  verify: (token: string) =>
    verify(token, JWT_SECRET, 'HS256') as unknown as Promise<JwtPayload>,
}
