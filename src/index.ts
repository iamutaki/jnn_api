import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import type { Env } from './types'
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
    name: 'JNN API',
    version: '0.0.1',
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
  return c.json({error: 'Route not found' }, 404)
})

// ─── Global Error Handler ─────────────────────────────────────────────
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({error: 'Internal server error' }, 500)
})

// Cloudflare Workers export
export default app
