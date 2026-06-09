import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import type { Env } from './types'
import { response } from './lib/response'
import { authRoutes } from './features/auth/routes/auth.routes'
import { dummyRoutes } from './features/dummy/routes/dummy.routes'
import { districtRoutes } from './features/district/routes/district.routes'

const app = new Hono<Env>()

// ─── Global Middleware ────────────────────────────────────────────────
app.use('*', cors())        // Enable CORS for mobile client
app.use('*', logger())      // Request logging
app.use('*', prettyJSON())  // Pretty JSON in dev

// ─── Health Check ─────────────────────────────────────────────────────
app.get('/', (c) => {
  return c.json({
    name: c.env.API_NAME,
    version: c.env.API_VERSION,
    environment: c.env.ENVIRONMENT,
    status: 'running',
    endpoints: {
      auth: '/auth/login',
      dummy: '/dummy',
      district: '/district',
    },
  })
})

// ─── Feature Routes ───────────────────────────────────────────────────
app.route('/auth', authRoutes)
app.route('/dummy', dummyRoutes)
app.route('/district', districtRoutes)

// ─── 404 Fallback ─────────────────────────────────────────────────────
app.notFound((c) => {
  return response.error(c, 'Route not found', 404, 'ROUTE_NOT_FOUND')
})

// ─── Global Error Handler ─────────────────────────────────────────────
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return response.error(c, 'Internal server error', 500, 'INTERNAL_ERROR')
})

// Cloudflare Workers export
export default app
