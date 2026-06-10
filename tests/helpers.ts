import app from '../src/index'

const JWT_SECRET = 'k4.local.tbD03hhqvTxQzAeDMonCXQ9ySpi6OLwuReDMpe8tZyM'

interface FetchOptions {
  method?: string
  body?: unknown
  token?: string
}

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
      DB: {} as D1Database,
      API_NAME: 'JNN API (Test)',
      API_VERSION: '0.0.1',
      ENVIRONMENT: 'test',
      JWT_SECRET,
    } as any,
  )
}

export async function parseResponse<T = any>(res: Response): Promise<{
  status: number
  body: T
}> {
  return {
    status: res.status,
    body: await res.json() as T,
  }
}
