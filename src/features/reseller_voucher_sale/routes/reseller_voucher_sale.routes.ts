import { Hono } from 'hono'
import { authMiddleware } from '../../../middlewares/auth'
import type { Env } from '../../../types'
import { resellerVoucherSaleController } from '../controller/reseller_voucher_sale.controller'

const resellerVoucherSaleRoutes = new Hono<Env>()

resellerVoucherSaleRoutes.use('/*', authMiddleware)

/**
 * Endpoints:
 *
 * GET    /                          → List sales (header only, cursor-based pagination: ?cursor=<ulid>&limit=20)
 * GET    /:id                       → Get one sale (items + allocated code metadata)
 * POST   /                          → Create sale (draft)  { resellerId, saleDate, saleMonth?, saleNo?, items[{voucherId, qty, unitPrice?}] }
 * PATCH  /:id                       → Edit (draft only) { resellerId?, saleDate?, saleMonth?, saleNo?, items? } — atomic single txn
 * POST   /:id/complete              → draft → completed (allocates codes from the digital_vouchers pool, sub-district scoped)
 * POST   /:id/cancel                → draft|completed → cancelled (releases allocated codes if completed)
 * DELETE /:id                        → Soft delete (draft only; cascade to items)
 * GET    /:id/logs                  → Audit trail (status transitions)
 *
 * State machine: draft → {completed | cancelled}; completed → cancelled (reverse-allocates codes).
 * saleNo auto-generated from incremental_code_configs ('sale') when omitted.
 * item.unitPrice defaults to vouchers.price when omitted; total_amount is computed server-side.
 */
resellerVoucherSaleRoutes.get('/', resellerVoucherSaleController.list)
resellerVoucherSaleRoutes.get('/:id', resellerVoucherSaleController.getOne)
resellerVoucherSaleRoutes.post('/', resellerVoucherSaleController.create)
resellerVoucherSaleRoutes.patch('/:id', resellerVoucherSaleController.update)
resellerVoucherSaleRoutes.post('/:id/complete', resellerVoucherSaleController.complete)
resellerVoucherSaleRoutes.post('/:id/cancel', resellerVoucherSaleController.cancel)
resellerVoucherSaleRoutes.delete('/:id', resellerVoucherSaleController.remove)
resellerVoucherSaleRoutes.get('/:id/logs', resellerVoucherSaleController.logs)

export { resellerVoucherSaleRoutes }
