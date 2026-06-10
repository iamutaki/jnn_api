import { Hono } from 'hono'
import { authMiddleware } from '../../../middlewares/auth'
import type { Env } from '../../../types'
import { subDistrictVoucherController } from '../controller/sub_district_voucher.controller'

const subDistrictVoucherRoutes = new Hono<Env>()

subDistrictVoucherRoutes.use('/*', authMiddleware)

/**
 * Nested Endpoints (mounted at /sub-district/:subDistrictId/voucher):
 *
 * GET  /  → List vouchers for this sub-district
 * PUT  /  → Sync vouchers  { voucherIds: [...] }  (bulk replace)
 */
subDistrictVoucherRoutes.get('/', subDistrictVoucherController.list)
subDistrictVoucherRoutes.put('/', subDistrictVoucherController.sync)

export { subDistrictVoucherRoutes }
