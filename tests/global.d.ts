/// <reference types="@cloudflare/workers-types" />

// Module declarations for cloudflare:test and cloudflare:workers
// These are provided at runtime by @cloudflare/vitest-pool-workers

declare module 'cloudflare:test' {
  export const env: Cloudflare.Env
  export const SELF: Fetcher
  export function reset(): Promise<void>
  export function applyD1Migrations(
    db: D1Database,
    migrations: Array<{ name: string; queries: string[] }>,
    migrationsTableName?: string,
  ): Promise<void>
}

declare module 'cloudflare:workers' {
  export type Env = Cloudflare.Env
}

declare module '@cloudflare/vitest-pool-workers' {
  interface D1Migration {
    name: string
    queries: string[]
  }
  export function readD1Migrations(migrationsDir: string): Promise<D1Migration[]>
}
