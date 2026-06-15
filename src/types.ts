import type { TokenPayload } from './lib/token'

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
  TOKEN_SECRET: string
  // Firebase Cloud Messaging
  FIREBASE_PROJECT_ID: string
  FIREBASE_CLIENT_EMAIL: string
  FIREBASE_PRIVATE_KEY: string
  // Voucher code encryption (digital_vouchers) — AES-256-GCM (per-version key) + HMAC
  VOUCHER_ENCRYPTION_KEY_V1: string
  VOUCHER_HASH_KEY_V1: string
  VOUCHER_KEY_VERSION: string // current active key version, e.g. "1"
}

export type Env = {
  Bindings: Bindings
  Variables: {
    user: TokenPayload
  }
}
