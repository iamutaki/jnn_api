/**
 * Test helpers for integration tests.
 *
 * Uses the actual Hono app + D1 database via vitest-pool-workers.
 * This means tests run in the real Workers runtime with real D1 (in-memory SQLite).
 */
import app from '../src/index'
import { jwtUtil } from '../src/lib/jwt'

const JWT_SECRET = 'test-secret-key'

/**
 * Generate a valid auth token for testing.
 */
export async function getAuthToken(secret = JWT_SECRET): Promise<string> {
  return jwtUtil.signAccess({ sub: 'test-user' }, secret)
}

/**
 * Generate an expired token for testing.
 * Sets exp to 1 second ago — the token is already expired.
 */
export async function getExpiredToken(secret = JWT_SECRET): Promise<string> {
  // Manually create an expired token by setting exp in the past
  const { sign } = await import('hono/jwt')
  return sign({ sub: 'test-user', exp: Math.floor(Date.now() / 1000) - 1 }, secret, 'HS256')
}

interface FetchOptions {
  method?: string
  body?: unknown
  token?: string
}

/**
 * Make a request to the app using Web APIs (available in Workers runtime).
 * This bypasses the network layer entirely — direct in-process call.
 */
export function appFetch(path: string, options: FetchOptions = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`
  }

  return app.fetch(
    new Request(`http://localhost${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    }),
    {
      DB: {} as D1Database, // Will be overridden by vitest-pool-workers
      API_NAME: 'JNN API (Test)',
      API_VERSION: '0.0.1',
      ENVIRONMENT: 'test',
      JWT_SECRET,
    } as any,
  )
}

/**
 * Parse JSON response from the app.
 */
export async function parseResponse<T = any>(res: Response): Promise<{
  status: number
  body: T
}> {
  return {
    status: res.status,
    body: await res.json() as T,
  }
}
