import { Hono } from 'hono'
import { authMiddleware } from '../../../middlewares/auth'
import type { Env } from '../../../types'
import { digitalVoucherController } from '../controller/digital_voucher.controller'

const digitalVoucherRoutes = new Hono<Env>()

digitalVoucherRoutes.use('/*', authMiddleware)

/**
 * Endpoints:
 *
 * GET    /                         → List (metadata only, NEVER decrypted codes)
 * GET    /:id                      → Detail (decrypts and returns `code`)
 * GET    /by-code?code=...         → Lookup by plaintext code (decrypts, available only)
 * POST   /                         → Create one     { voucherId, subDistrictId?, code }
 * POST   /bulk                     → Create many    { items: [{ voucherId, subDistrictId?, code }] }  (all-or-nothing)
 * DELETE /:id                      → Soft delete
 *
 * Note: a code is blocked only while an AVAILABLE, non-deleted row holds it.
 * Once sold or soft-deleted, the SAME code may be re-inserted.
 */
digitalVoucherRoutes.get('/', digitalVoucherController.list)
digitalVoucherRoutes.get('/by-code', digitalVoucherController.getByCode)
digitalVoucherRoutes.get('/:id', digitalVoucherController.getOne)
digitalVoucherRoutes.post('/', digitalVoucherController.create)
digitalVoucherRoutes.post('/bulk', digitalVoucherController.createBulk)
digitalVoucherRoutes.delete('/:id', digitalVoucherController.remove)

export { digitalVoucherRoutes }
