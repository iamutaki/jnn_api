import type { JwtPayload } from './lib/jwt'

/**
 * Hono environment bindings type.
 *
 * Cloudflare Workers injects bindings via `c.env`.
 * This type tells TypeScript what's available.
 */
type Bindings = {
  // D1 Database
  DB: D1Database
  // Config (from [vars] in wrangler.toml)
  API_NAME: string
  API_VERSION: string
  ENVIRONMENT: string
  // Secrets (from `wrangler secret put` / .env)
  JWT_SECRET: string
}

export type Env = {
  Bindings: Bindings
  Variables: {
    user: JwtPayload
  }
}
