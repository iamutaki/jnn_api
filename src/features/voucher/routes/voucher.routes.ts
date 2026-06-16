import { Hono } from 'hono'
import { authMiddleware, requireRoles } from '../../../middlewares/auth'
import type { Env } from '../../../types'
import { voucherController } from '../controller/voucher.controller'

const voucherRoutes = new Hono<Env>()

voucherRoutes.use('/*', authMiddleware)

/**
 * CRUD Endpoints:
 *
 * GET    /voucher      → List all vouchers
 * GET    /voucher/:id  → Get one voucher
 * POST   /voucher      → Create voucher  { name, price, description? }
 * PATCH  /voucher/:id  → Update voucher  { name?, price?, description? }
 * DELETE /voucher/:id  → Delete voucher (soft)
 */
voucherRoutes.get('/', voucherController.list)
voucherRoutes.get('/:id', voucherController.getOne)
voucherRoutes.post('/', requireRoles('root', 'owner', 'supervisor'), voucherController.create)
voucherRoutes.patch('/:id', requireRoles('root', 'owner', 'supervisor'), voucherController.update)
voucherRoutes.delete('/:id', requireRoles('root', 'owner', 'supervisor'), voucherController.remove)

export { voucherRoutes }
