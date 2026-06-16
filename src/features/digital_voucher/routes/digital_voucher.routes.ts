import { Hono } from 'hono'
import { authMiddleware, requireRoles } from '../../../middlewares/auth'
import type { Env } from '../../../types'
import { digitalVoucherController } from '../controller/digital_voucher.controller'

const digitalVoucherRoutes = new Hono<Env>()

digitalVoucherRoutes.use('/*', authMiddleware)

/**
 * Endpoints:
 *
 * GET    /                         → List (metadata only, NEVER decrypted codes)
 * GET    /imports                  → Import history (cursor-based pagination: ?cursor=<ulid>&limit=20)
 * GET    /:id                      → Detail (decrypts and returns `code`)
 * GET    /by-code?code=...         → Lookup by plaintext code (decrypts, available only)
 * POST   /                         → Create one     { voucherId, subDistrictId?, code }
 *                                    Returns { id, importId }
 * POST   /bulk                     → Create many    { items: [{ voucherId, subDistrictId?, code }] }  (all-or-nothing)
 *                                    Returns { created, importIds[] }
 * DELETE /:id                      → Soft delete
 *
 * Note: a code is blocked only while an AVAILABLE, non-deleted row holds it.
 * Once sold or soft-deleted, the SAME code may be re-inserted.
 *
 * Each create (single or bulk) records an import batch in digital_voucher_imports,
 * linked via digital_vouchers.import_id — enabling import activity rekap.
 */
digitalVoucherRoutes.get('/', digitalVoucherController.list)
digitalVoucherRoutes.get('/imports', digitalVoucherController.listImports)
digitalVoucherRoutes.get('/by-code', digitalVoucherController.getByCode)
digitalVoucherRoutes.get('/:id', digitalVoucherController.getOne)
digitalVoucherRoutes.post('/', requireRoles('root', 'owner', 'supervisor'), digitalVoucherController.create)
digitalVoucherRoutes.post('/bulk', requireRoles('root', 'owner', 'supervisor'), digitalVoucherController.createBulk)
digitalVoucherRoutes.delete('/:id', requireRoles('root', 'owner', 'supervisor'), digitalVoucherController.remove)

export { digitalVoucherRoutes }
