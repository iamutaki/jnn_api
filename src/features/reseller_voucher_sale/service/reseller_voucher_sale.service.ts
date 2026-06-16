import { ulid } from '../../../lib/ulid'
import { decryptCode } from '../../../lib/voucher-crypto'
import { codeGeneratorService } from '../../code_generator/service/code_generator.service'
import type { Env } from '../../../types'
import type {
  ResellerVoucherSale,
  ResellerVoucherSaleListItem,
  ResellerVoucherSaleDetail,
  SaleItemResponse,
  SaleViewer,
  CreateResellerVoucherSaleRequest,
  UpdateResellerVoucherSaleRequest,
  ResellerVoucherSaleLog,
} from '../reseller_voucher_sale.types'

const ISO = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')"

// Fallback reseller for sales created by non-reseller users (e.g. admins). Seeded by
// migration 0027. Region-agnostic (sub_district_id NULL) → complete() allocates pool-wide.
export const SYSTEM_RESELLER_ID = '01KT0SYSTEM000000000000000'

export class SaleError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export const resellerVoucherSaleService = {
  getAll: async (
    db: D1Database,
    viewer: SaleViewer,
    cursor?: string,
    limit = 20,
  ): Promise<{ items: ResellerVoucherSaleListItem[]; nextCursor: string | null }> => {
    // Fetch limit + 1 to detect if there's a next page. Cursor pages by `id`
    // (a ULID, time-sortable) and sorts by the same column, so the boundary is
    // stable even when multiple rows share a created_at timestamp.
    const fetchLimit = limit + 1

    let sql = `SELECT id, reseller_id, sale_no, sale_date, sale_month, total_qty, total_amount, status, completed_at, cancelled_at
                 FROM reseller_voucher_sales
                WHERE deleted_at IS NULL`
    const bind: unknown[] = []

    if (!viewer.viewAll) {
      sql += ' AND reseller_id = ?'
      bind.push(viewer.resellerId)
    }

    if (cursor) {
      sql += ' AND id < ?'
      bind.push(cursor)
    }

    sql += ' ORDER BY id DESC LIMIT ?'
    bind.push(fetchLimit)

    const result = await db.prepare(sql).bind(...bind).all<any>()

    const rows = result.results
    const hasMore = rows.length > limit
    if (hasMore) rows.pop()

    const items = rows.map((r: any) => ({
      id: r.id,
      resellerId: r.reseller_id,
      saleNo: r.sale_no,
      saleDate: r.sale_date,
      saleMonth: r.sale_month,
      totalQty: r.total_qty,
      totalAmount: r.total_amount,
      status: r.status,
      completedAt: r.completed_at,
      cancelledAt: r.cancelled_at,
    }))

    return { items, nextCursor: hasMore ? rows[rows.length - 1].id : null }
  },

  getById: async (
    db: D1Database,
    env: Env['Bindings'],
    id: string,
    viewer: SaleViewer,
  ): Promise<ResellerVoucherSaleDetail | null> => {
    const sale = await resellerVoucherSaleService._getFull(db, id)
    if (!sale) return null
    if (!viewer.viewAll && sale.reseller_id !== viewer.resellerId) return null

    const items = await db
      .prepare(
        `SELECT id, voucher_id, qty, unit_price, total_amount
           FROM reseller_voucher_sale_items
          WHERE sale_id = ? AND deleted_at IS NULL
          ORDER BY created_at ASC`,
      )
      .bind(id)
      .all<{ id: string; voucher_id: string; qty: number; unit_price: number; total_amount: number }>()

    const detailItems: SaleItemResponse[] = await Promise.all(
      items.results.map(async (it) => {
        // Pull each allocated code's metadata + crypto material + the seller. Plaintext is
        // revealed only to the seller (sold_by_user_id === caller); everyone else gets the
        // "******" mask. Draft sales have no link rows, so allocatedCodes is [] for them.
        const codes = await db
          .prepare(
            `SELECT dv.id, dv.status, dv.sold_by_user_id,
                    dv.encrypted_code, dv.encryption_iv, dv.encryption_tag, dv.encryption_key_version
               FROM reseller_voucher_sale_item_digital_vouchers link
               JOIN digital_vouchers dv ON dv.id = link.digital_voucher_id
              WHERE link.sale_item_id = ? AND link.deleted_at IS NULL
              ORDER BY link.created_at ASC`,
          )
          .bind(it.id)
          .all<{
            id: string
            status: string
            sold_by_user_id: string | null
            encrypted_code: string
            encryption_iv: string
            encryption_tag: string
            encryption_key_version: number
          }>()

        const allocatedCodes = await Promise.all(
          codes.results.map(async (c) => ({
            id: c.id,
            status: c.status,
            code:
              c.sold_by_user_id === viewer.userId
                ? await decryptCode(c.encrypted_code, c.encryption_iv, c.encryption_tag, c.encryption_key_version, env)
                : '******',
          })),
        )

        return {
          id: it.id,
          voucherId: it.voucher_id,
          qty: it.qty,
          unitPrice: it.unit_price,
          totalAmount: it.total_amount,
          allocatedCodes,
        }
      }),
    )

    return {
      id: sale.id,
      resellerId: sale.reseller_id,
      saleNo: sale.sale_no,
      saleDate: sale.sale_date,
      saleMonth: sale.sale_month,
      totalQty: sale.total_qty,
      totalAmount: sale.total_amount,
      status: sale.status,
      completedAt: sale.completed_at,
      cancelledAt: sale.cancelled_at,
      items: detailItems,
    }
  },

  _getFull: async (db: D1Database, id: string): Promise<ResellerVoucherSale | null> => {
    return db
      .prepare('SELECT * FROM reseller_voucher_sales WHERE id = ? AND deleted_at IS NULL')
      .bind(id)
      .first<ResellerVoucherSale>()
  },

  _resellerExists: async (db: D1Database, id: string): Promise<boolean> => {
    const row = await db.prepare('SELECT 1 FROM resellers WHERE id = ? AND deleted_at IS NULL').bind(id).first()
    return row !== null
  },

  // Resolve a sale's reseller_id from the caller: a reseller user is attributed to their own
  // reseller id (resellers.id == users.id); everyone else (admin/staff) falls back to the
  // System reseller. reseller_id is NEVER taken from the request body.
  _resolveResellerId: async (db: D1Database, userId: string): Promise<string> => {
    const isReseller = await resellerVoucherSaleService._resellerExists(db, userId)
    return isReseller ? userId : SYSTEM_RESELLER_ID
  },

  // Resolve viewer authorization scope. Users with oversight roles (root / owner / supervisor)
  // see all sales (viewAll = true). Everyone else is scoped to their own reseller id only.
  _resolveViewer: async (db: D1Database, userId: string): Promise<SaleViewer> => {
    const roles = await db
      .prepare(
        `SELECT r.name
           FROM user_roles ur
           JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = ?`,
      )
      .bind(userId)
      .all<{ name: string }>()

    const viewAll = roles.results.some((r) => r.name === 'root' || r.name === 'owner' || r.name === 'supervisor')

    return { userId, resellerId: userId, viewAll }
  },

  // Check whether there are enough available digital_vouchers in the reseller's
  // allocation scope (sub-district, or pool-wide for System) to fulfill every item.
  // Throws SALE_INSUFFICIENT_STOCK with the voucher name if any item falls short.
  _checkStockAvailable: async (
    db: D1Database,
    resellerId: string,
    items: { voucherId: string; qty: number }[],
  ): Promise<void> => {
    const subDistrictId = await resellerVoucherSaleService._getResellerSubDistrict(db, resellerId)
    const scoped = subDistrictId !== null

    // Resolve voucher names for a human-friendly error.
    const voucherIds = [...new Set(items.map((i) => i.voucherId))]
    const voucherRows = voucherIds.length
      ? await db
          .prepare(`SELECT id, name FROM vouchers WHERE id IN (${voucherIds.map(() => '?').join(',')})`)
          .bind(...voucherIds)
          .all<{ id: string; name: string }>()
      : { results: [] as { id: string; name: string }[] }
    const voucherNames = new Map(voucherRows.results.map((v) => [v.id, v.name]))

    for (const item of items) {
      const row = scoped
        ? await db
            .prepare(
              `SELECT COUNT(*) as available
                 FROM digital_vouchers
                WHERE voucher_id = ? AND status = 'available' AND deleted_at IS NULL
                  AND (sub_district_id = ? OR sub_district_id IS NULL)`,
            )
            .bind(item.voucherId, subDistrictId)
            .first<{ available: number }>()
        : await db
            .prepare(
              `SELECT COUNT(*) as available
                 FROM digital_vouchers
                WHERE voucher_id = ? AND status = 'available' AND deleted_at IS NULL`,
            )
            .bind(item.voucherId)
            .first<{ available: number }>()

      const available = row?.available ?? 0
      if (available < item.qty) {
        const vName = voucherNames.get(item.voucherId) ?? item.voucherId
        throw new SaleError('SALE_INSUFFICIENT_STOCK', `Stok tidak mencukupi untuk ${vName}`)
      }
    }
  },

  _voucherExists: async (db: D1Database, id: string): Promise<boolean> => {
    const row = await db.prepare('SELECT 1 FROM vouchers WHERE id = ? AND deleted_at IS NULL').bind(id).first()
    return row !== null
  },

  // vouchers.price — used to default an item's unit_price when the client omits it.
  _voucherPrice: async (db: D1Database, id: string): Promise<number | null> => {
    const row = await db
      .prepare('SELECT price FROM vouchers WHERE id = ? AND deleted_at IS NULL')
      .bind(id)
      .first<{ price: number }>()
    return row?.price ?? null
  },

  // reseller.sub_district_id — the allocation scope for complete().
  _getResellerSubDistrict: async (db: D1Database, id: string): Promise<string | null> => {
    const row = await db
      .prepare('SELECT sub_district_id FROM resellers WHERE id = ? AND deleted_at IS NULL')
      .bind(id)
      .first<{ sub_district_id: string }>()
    return row?.sub_district_id ?? null
  },

  _saleNoExists: async (db: D1Database, saleNo: string, excludeId?: string): Promise<boolean> => {
    if (excludeId) {
      const row = await db
        .prepare('SELECT 1 FROM reseller_voucher_sales WHERE sale_no = ? AND id != ? AND deleted_at IS NULL')
        .bind(saleNo, excludeId)
        .first()
      return row !== null
    }
    const row = await db
      .prepare('SELECT 1 FROM reseller_voucher_sales WHERE sale_no = ? AND deleted_at IS NULL')
      .bind(saleNo)
      .first()
    return row !== null
  },

  // Active sale carrying this Idempotency-Key (if any) → replay target.
  _getByIdempotencyKey: async (db: D1Database, key: string): Promise<{ id: string } | null> => {
    return db
      .prepare('SELECT id FROM reseller_voucher_sales WHERE idempotency_key = ? AND deleted_at IS NULL')
      .bind(key)
      .first<{ id: string }>()
  },

  // Create draft sale + items + 'created' log in one atomic batch. saleNo auto-
  // generated unless provided (retroactive). saleMonth derived from saleDate if absent.
  // unit_price defaults to vouchers.price; total_amount computed server-side.
  // Idempotency-Key is required: a replay returns the existing sale id instead of
  // minting a new ULID + sale_no. (idx_rvs_idempotency_key is the backstop.)
  create: async (
    db: D1Database,
    body: CreateResellerVoucherSaleRequest,
    userId: string,
    idempotencyKey: string,
  ): Promise<{ id: string; replayed: boolean }> => {
    // Idempotency pre-check: a stable client-supplied key (Idempotency-Key header) dedupes
    // retries. If an active sale already carries this key, replay it — return its id instead
    // of minting a new ULID + sale_no. (idx_rvs_idempotency_key is the backstop.)
    const existing = await resellerVoucherSaleService._getByIdempotencyKey(db, idempotencyKey)
    if (existing) return { id: existing.id, replayed: true }

    const id = ulid()
    const saleNo = body.saleNo ?? (await codeGeneratorService.generate(db, 'sale', userId))
    const saleMonth = body.saleMonth ?? body.saleDate.slice(0, 7)
    const resellerId = await resellerVoucherSaleService._resolveResellerId(db, userId)

    let totalQty = 0
    let totalAmount = 0
    const resolvedItems: { voucherId: string; qty: number; unitPrice: number }[] = []
    for (const item of body.items) {
      const unitPrice = item.unitPrice ?? (await resellerVoucherSaleService._voucherPrice(db, item.voucherId)) ?? 0
      totalQty += item.qty
      totalAmount += item.qty * unitPrice
      resolvedItems.push({ voucherId: item.voucherId, qty: item.qty, unitPrice })
    }

    // Pre-check stock availability so the caller knows before a draft is created.
    await resellerVoucherSaleService._checkStockAvailable(db, resellerId, resolvedItems)

    const stmts: D1PreparedStatement[] = [
      db
        .prepare(
          `INSERT INTO reseller_voucher_sales
            (id, reseller_id, sale_no, sale_date, sale_month, total_qty, total_amount, status,
             idempotency_key, created_by_user_id, updated_by_user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
        )
        .bind(id, resellerId, saleNo, body.saleDate, saleMonth, totalQty, totalAmount, idempotencyKey, userId, userId),
      db
        .prepare(
          `INSERT INTO reseller_voucher_sale_logs
            (id, sale_id, action, old_status, new_status, changed_by_user_id, note)
           VALUES (?, ?, 'created', NULL, 'draft', ?, NULL)`,
        )
        .bind(ulid(), id, userId),
    ]

    for (const it of resolvedItems) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO reseller_voucher_sale_items
              (id, sale_id, voucher_id, qty, unit_price, total_amount, created_by_user_id, updated_by_user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(ulid(), id, it.voucherId, it.qty, it.unitPrice, it.qty * it.unitPrice, userId, userId),
      )
    }

    try {
      await db.batch(stmts)
    } catch (err) {
      // Concurrent duplicate raced past the pre-check (two retries, both SELECT before either
      // INSERT). idx_rvs_idempotency_key rejects the loser; if a sale now exists for this key,
      // treat it as a replay instead of surfacing a 500.
      const existing = await resellerVoucherSaleService._getByIdempotencyKey(db, idempotencyKey)
      if (existing) return { id: existing.id, replayed: true }
      throw err
    }
    return { id, replayed: false }
  },

  // PATCH update — DRAFT only. Header fields partial AND/OR items full-replace, in ONE
  // atomic batched transaction (no split calls). If `items` is present, the entire items
  // list is replaced (diffed: soft-delete missing / update changed / insert new) and totals
  // are recomputed. Returns false if missing or not 'draft'.
  update: async (
    db: D1Database,
    id: string,
    patch: UpdateResellerVoucherSaleRequest,
    userId: string,
  ): Promise<boolean> => {
    const sale = await resellerVoucherSaleService._getFull(db, id)
    if (!sale || sale.status !== 'draft') return false

    const stmts: D1PreparedStatement[] = []
    let headerTouched = false

    // --- header fields (partial) ---
    const sets: string[] = [`updated_at = ${ISO}`, 'updated_by_user_id = ?']
    const binds: any[] = [userId]
    if (patch.saleDate !== undefined) {
      sets.push('sale_date = ?')
      binds.push(patch.saleDate)
      headerTouched = true
    }
    if (patch.saleMonth !== undefined) {
      sets.push('sale_month = ?')
      binds.push(patch.saleMonth)
      headerTouched = true
    }
    if (patch.saleNo !== undefined) {
      sets.push('sale_no = ?')
      binds.push(patch.saleNo)
      headerTouched = true
    }
    if (headerTouched) {
      stmts.push(db.prepare(`UPDATE reseller_voucher_sales SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, id))
    }

    // --- items (full replace if present) ---
    if (patch.items !== undefined) {
      const incoming = patch.items
      const existing = await db
        .prepare('SELECT id, voucher_id, qty, unit_price FROM reseller_voucher_sale_items WHERE sale_id = ? AND deleted_at IS NULL')
        .bind(id)
        .all<{ id: string; voucher_id: string; qty: number; unit_price: number }>()

      // Resolve incoming unit_prices (default → vouchers.price).
      const resolvedIncoming = await Promise.all(
        incoming.map(async (inc) => ({
          voucherId: inc.voucherId,
          qty: inc.qty,
          unitPrice: inc.unitPrice ?? (await resellerVoucherSaleService._voucherPrice(db, inc.voucherId)) ?? 0,
        })),
      )

      const existingByVoucher = new Map(existing.results.map((r) => [r.voucher_id, r]))
      const incomingVoucherIds = new Set(resolvedIncoming.map((i) => i.voucherId))

      // Walk existing: soft-delete missing, update changed qty/price.
      for (const [voucherId, row] of existingByVoucher) {
        if (!incomingVoucherIds.has(voucherId)) {
          stmts.push(
            db.prepare(`UPDATE reseller_voucher_sale_items SET deleted_at = ${ISO}, deleted_by_user_id = ? WHERE id = ?`).bind(userId, row.id),
          )
        } else {
          const inc = resolvedIncoming.find((i) => i.voucherId === voucherId)!
          if (inc.qty !== row.qty || inc.unitPrice !== row.unit_price) {
            stmts.push(
              db
                .prepare(
                  `UPDATE reseller_voucher_sale_items SET qty = ?, unit_price = ?, total_amount = ?, updated_at = ${ISO}, updated_by_user_id = ? WHERE id = ?`,
                )
                .bind(inc.qty, inc.unitPrice, inc.qty * inc.unitPrice, userId, row.id),
            )
          }
        }
      }

      // Walk incoming: insert new voucherIds.
      for (const inc of resolvedIncoming) {
        if (!existingByVoucher.has(inc.voucherId)) {
          stmts.push(
            db
              .prepare(
                `INSERT INTO reseller_voucher_sale_items (id, sale_id, voucher_id, qty, unit_price, total_amount, created_by_user_id, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              )
              .bind(ulid(), id, inc.voucherId, inc.qty, inc.unitPrice, inc.qty * inc.unitPrice, userId, userId),
          )
        }
      }

      // Recompute totals from the new full item set + bump updated_at.
      const totalQty = resolvedIncoming.reduce((s, i) => s + i.qty, 0)
      const totalAmount = resolvedIncoming.reduce((s, i) => s + i.qty * i.unitPrice, 0)
      stmts.push(
        db
          .prepare(`UPDATE reseller_voucher_sales SET total_qty = ?, total_amount = ?, updated_at = ${ISO}, updated_by_user_id = ? WHERE id = ?`)
          .bind(totalQty, totalAmount, userId, id),
      )
    }

    await db.batch(stmts)
    return true
  },

  // Undo a complete() in flight: release every code this sale bound AND flip it back to
  // draft, so a failed complete() leaves the sale exactly as it started (no stranded 'sold'
  // codes, status not stuck on 'completed'). Used for both partial-fill rollback (Phase 1)
  // and final-commit failure (Phase 2). Also reverts the atomic status flip from Phase 0.
  _revertCompletion: async (db: D1Database, saleId: string, userId: string): Promise<void> => {
    await db.batch([
      db
        .prepare(
          `UPDATE digital_vouchers
              SET status = 'available', sold_to_reseller_id = NULL, sold_sale_id = NULL,
                  sold_at = NULL, sold_by_user_id = NULL, updated_at = ${ISO}, updated_by_user_id = ?
            WHERE sold_sale_id = ?`,
        )
        .bind(userId, saleId),
      db
        .prepare(
          `UPDATE reseller_voucher_sales
              SET status = 'draft', completed_at = NULL, updated_at = ${ISO}, updated_by_user_id = ?
            WHERE id = ?`,
        )
        .bind(userId, saleId),
    ])
  },

  // draft → completed. Atomically allocates codes from the digital_vouchers pool per
  // sale item, sub-district scoped (reseller's region first, NULL/unscoped fallback;
  // other regions excluded). All-or-nothing: if any item can't fill its qty, every
  // claim is released and SALE_INSUFFICIENT_STOCK is thrown (sale reverts to draft).
  //
  // Concurrency: the status transition is an atomic check-and-set (draft→completed via
  // WHERE status='draft') done BEFORE allocation (Phase 0), so two concurrent completes of
  // the same sale can't both proceed — the loser's UPDATE changes 0 rows and bails. Any
  // failure after Phase 0 (partial fill or commit error) is rolled back by _revertCompletion,
  // which releases claimed codes and returns the sale to draft.
  complete: async (db: D1Database, id: string, userId: string): Promise<boolean> => {
    // --- Phase 0: atomic check-and-set draft → completed ---
    // Guards against concurrent completes and completes of a non-draft sale in one statement.
    const flipped = await db
      .prepare(
        `UPDATE reseller_voucher_sales
            SET status = 'completed', completed_at = ${ISO}, updated_at = ${ISO}, updated_by_user_id = ?
          WHERE id = ? AND status = 'draft'`,
      )
      .bind(userId, id)
      .run()
    if (!flipped.meta.changes || flipped.meta.changes < 1) return false

    const sale = await resellerVoucherSaleService._getFull(db, id)
    if (!sale) {
      // Practically unreachable (the flip just touched this id), but stay safe.
      await resellerVoucherSaleService._revertCompletion(db, id, userId)
      return false
    }
    const subDistrictId = await resellerVoucherSaleService._getResellerSubDistrict(db, sale.reseller_id)
    // NULL sub_district (the System fallback reseller) → allocate pool-wide; else scoped to
    // the reseller's region. (Real resellers always have a sub_district; only System is NULL.)
    const scoped = subDistrictId !== null

    const items = await db
      .prepare('SELECT id, voucher_id, qty FROM reseller_voucher_sale_items WHERE sale_id = ? AND deleted_at IS NULL')
      .bind(id)
      .all<{ id: string; voucher_id: string; qty: number }>()

    // Resolve voucher names for human-readable error messages.
    const voucherIds = [...new Set(items.results.map((i) => i.voucher_id))]
    const voucherRows = voucherIds.length
      ? await db
          .prepare(`SELECT id, name FROM vouchers WHERE id IN (${voucherIds.map(() => '?').join(',')})`)
          .bind(...voucherIds)
          .all<{ id: string; name: string }>()
      : { results: [] as { id: string; name: string }[] }
    const voucherNames = new Map(voucherRows.results.map((v) => [v.id, v.name]))

    // --- Phase 1: atomic per-item claim via UPDATE…RETURNING ---
    // Each claim is a single serialized write: the subquery picks N available codes and the
    // outer UPDATE flips them to sold-to-this-sale in one step, so two concurrent completes
    // can never grab the same code. Scoped resellers prefer their region then unscoped (NULL);
    // the System reseller (NULL region) takes any available code pool-wide (FIFO).
    const claimed: { saleItemId: string; dvIds: string[] }[] = []
    for (const item of items.results) {
      const claim = scoped
        ? await db
            .prepare(
              `UPDATE digital_vouchers
                  SET status = 'sold', sold_to_reseller_id = ?, sold_sale_id = ?, sold_at = ${ISO}, sold_by_user_id = ?,
                      updated_at = ${ISO}, updated_by_user_id = ?
                WHERE id IN (
                  SELECT id FROM digital_vouchers
                   WHERE voucher_id = ? AND status = 'available' AND deleted_at IS NULL
                     AND (sub_district_id = ? OR sub_district_id IS NULL)
                   ORDER BY (sub_district_id = ?) DESC, created_at ASC
                   LIMIT ?
                )
                RETURNING id`,
            )
            .bind(sale.reseller_id, id, userId, userId, item.voucher_id, subDistrictId, subDistrictId, item.qty)
            .all<{ id: string }>()
        : await db
            .prepare(
              `UPDATE digital_vouchers
                  SET status = 'sold', sold_to_reseller_id = ?, sold_sale_id = ?, sold_at = ${ISO}, sold_by_user_id = ?,
                      updated_at = ${ISO}, updated_by_user_id = ?
                WHERE id IN (
                  SELECT id FROM digital_vouchers
                   WHERE voucher_id = ? AND status = 'available' AND deleted_at IS NULL
                   ORDER BY created_at ASC
                   LIMIT ?
                )
                RETURNING id`,
            )
            .bind(sale.reseller_id, id, userId, userId, item.voucher_id, item.qty)
            .all<{ id: string }>()

      if (claim.results.length < item.qty) {
        // Partial fill → full rollback (release claims + revert status to draft).
        await resellerVoucherSaleService._revertCompletion(db, id, userId)
        const vName = voucherNames.get(item.voucher_id) ?? item.voucher_id
        throw new SaleError('SALE_INSUFFICIENT_STOCK', `Stok tidak mencukupi untuk ${vName}`)
      }
      claimed.push({ saleItemId: item.id, dvIds: claim.results.map((c) => c.id) })
    }

    // --- Phase 2: commit links + log (single atomic batch) ---
    const stmts: D1PreparedStatement[] = []
    for (const c of claimed) {
      for (const dvId of c.dvIds) {
        stmts.push(
          db
            .prepare(
              `INSERT INTO reseller_voucher_sale_item_digital_vouchers (id, sale_item_id, digital_voucher_id, created_by_user_id)
               VALUES (?, ?, ?, ?)`,
            )
            .bind(ulid(), c.saleItemId, dvId, userId),
        )
      }
    }
    stmts.push(
      db
        .prepare(
          `INSERT INTO reseller_voucher_sale_logs (id, sale_id, action, old_status, new_status, changed_by_user_id, note)
           VALUES (?, ?, 'completed', 'draft', 'completed', ?, NULL)`,
        )
        .bind(ulid(), id, userId),
    )

    try {
      await db.batch(stmts)
    } catch (err) {
      // Phase 2 failed after Phase 0 flipped status and Phase 1 claimed codes — roll the
      // whole thing back so no codes are stranded and the sale is draft again.
      await resellerVoucherSaleService._revertCompletion(db, id, userId)
      throw err
    }
    return true
  },

  // draft → cancelled. Draft sales carry no allocated codes, so cancel is just an atomic
  // status flip + log. Non-draft sales (completed/cancelled) are terminal and CANNOT be
  // cancelled — completed→cancelled (reverse-allocation) is intentionally not supported.
  // The WHERE status='draft' guard makes this idempotent against concurrent cancels.
  cancel: async (db: D1Database, id: string, userId: string): Promise<boolean> => {
    const result = await db
      .prepare(
        `UPDATE reseller_voucher_sales
            SET status = 'cancelled', cancelled_at = ${ISO}, updated_at = ${ISO}, updated_by_user_id = ?
          WHERE id = ? AND status = 'draft'`,
      )
      .bind(userId, id)
      .run()
    if (!result.meta.changes || result.meta.changes < 1) return false

    await db
      .prepare(
        `INSERT INTO reseller_voucher_sale_logs (id, sale_id, action, old_status, new_status, changed_by_user_id, note)
         VALUES (?, ?, 'cancelled', 'draft', 'cancelled', ?, NULL)`,
      )
      .bind(ulid(), id, userId)
      .run()
    return true
  },

  // Soft-delete cascade (DRAFT only): sale + its items. Non-draft sales are terminal
  // (completed/cancelled) and cannot be deleted.
  remove: async (db: D1Database, id: string, userId: string): Promise<boolean> => {
    const sale = await resellerVoucherSaleService._getFull(db, id)
    if (!sale || sale.status !== 'draft') return false
    await db.batch([
      db.prepare(`UPDATE reseller_voucher_sales SET deleted_at = ${ISO}, deleted_by_user_id = ? WHERE id = ?`).bind(userId, id),
      db.prepare(`UPDATE reseller_voucher_sale_items SET deleted_at = ${ISO}, deleted_by_user_id = ? WHERE sale_id = ?`).bind(userId, id),
    ])
    return true
  },

  getLogs: async (db: D1Database, id: string): Promise<ResellerVoucherSaleLog[]> => {
    const result = await db
      .prepare(
        `SELECT id, sale_id, action, old_status, new_status, changed_by_user_id, changed_at, note
           FROM reseller_voucher_sale_logs
          WHERE sale_id = ?
          ORDER BY changed_at ASC`,
      )
      .bind(id)
      .all<any>()
    return result.results.map((r: any) => ({
      id: r.id,
      saleId: r.sale_id,
      action: r.action,
      oldStatus: r.old_status,
      newStatus: r.new_status,
      changedByUserId: r.changed_by_user_id,
      changedAt: r.changed_at,
      note: r.note,
    }))
  },
}
