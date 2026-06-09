/**
 * Hono environment bindings type.
 *
 * Cloudflare Workers injects bindings via `c.env`.
 * This type tells TypeScript what's available.
 *
 * Add more bindings here as the project grows
 * (KV namespaces, R2 buckets, Durable Objects, etc.)
 */
type Bindings = {
  DB: D1Database
}

export type Env = {
  Bindings: Bindings
}
