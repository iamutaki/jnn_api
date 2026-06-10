import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import type { Env } from './types'
import { response } from './lib/response'
import { authRoutes } from './features/auth/routes/auth.routes'
import { dummyRoutes } from './features/dummy/routes/dummy.routes'
import { districtRoutes } from './features/district/routes/district.routes'
import { subDistrictRoutes } from './features/sub_district/routes/sub_district.routes'
import { roleRoutes } from './features/role/routes/role.routes'
import { userRoutes } from './features/user/routes/user.routes'
import { userRoleRoutes } from './features/user_role/routes/user_role.routes'
import { profileRoutes } from './features/profile/routes/profile.routes'
import { deviceRoutes } from './features/device/routes/device.routes'
import { notificationRoutes } from './features/notification/routes/notification.routes'
import { voucherRoutes } from './features/voucher/routes/voucher.routes'
import { subDistrictVoucherRoutes } from './features/sub_district_voucher/routes/sub_district_voucher.routes'
import { resellerRoutes } from './features/reseller/routes/reseller.routes'

const app = new Hono<Env>()

// ─── Global Middleware ────────────────────────────────────────────────
app.use('*', cors())
app.use('*', logger())
app.use('*', prettyJSON())

// // ─── API v2 (example) ──────────────────────────────────────────────────
// // 1. Buat sub-router baru
// const v2 = new Hono<Env>()
//
// // 2. Import routes v2 (misal dari features/<feature>/routes/<feature>.v2.routes.ts)
// import { authV2Routes } from './features/auth/routes/auth.v2.routes'
// import { userV2Routes } from './features/user/routes/user.v2.routes'
//
// // 3. Daftarkan route — bebas, tidak harus 1:1 dengan v1
// v2.route('/auth', authV2Routes)
// v2.route('/users', userV2Routes)         // misal jadi plural
//
// // 4. Mount ke /v2
// // app.route('/v2', v2)
//
// // ─── API v1 ──────────────────────────────────────────────────────────
const v1 = new Hono<Env>()

v1.route('/auth', authRoutes)
v1.route('/dummy', dummyRoutes)
v1.route('/district', districtRoutes)
v1.route('/role', roleRoutes)
v1.route('/user', userRoutes)
v1.route('/user-role', userRoleRoutes)
v1.route('/profile', profileRoutes)
v1.route('/device', deviceRoutes)
v1.route('/notification', notificationRoutes)
v1.route('/voucher', voucherRoutes)
v1.route('/sub-district', subDistrictRoutes)
v1.route('/sub-district/:subDistrictId/voucher', subDistrictVoucherRoutes)
v1.route('/reseller', resellerRoutes)

app.route('/v1', v1)

// ─── Health Check ─────────────────────────────────────────────────────
app.get('/', (c) => {
  return c.json({
    name: c.env.API_NAME,
    version: c.env.API_VERSION,
    environment: c.env.ENVIRONMENT,
    status: 'running',
    endpoints: {
      auth: '/v1/auth/login',
      dummy: '/v1/dummy',
      district: '/v1/district',
      sub_district: '/v1/sub-district',
      role: '/v1/role',
      user: '/v1/user',
      user_role: '/v1/user-role',
      profile: '/v1/profile',
      voucher: '/v1/voucher',
      reseller: '/v1/reseller',
      notification: '/v1/notification',
    },
  })
})

// ─── 404 Fallback ─────────────────────────────────────────────────────
app.notFound((c) => {
  return response.error(c, 'Route not found', 404, 'ROUTE_NOT_FOUND')
})

// ─── Global Error Handler ─────────────────────────────────────────────
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return response.error(c, 'Internal server error', 500, 'INTERNAL_ERROR')
})

export default app
