import type { Context } from 'hono'
import { response } from '../../../lib/response'
import { safeJsonBody } from '../../../lib/request'
import { validate } from '../../../lib/validation'
import type { Env } from '../../../types'
import { resellerVoucherSaleService, SaleError } from '../service/reseller_voucher_sale.service'

const SALE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/ // YYYY-MM-DD
const SALE_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/ // YYYY-MM

const CREATE_SCHEMA = {
  saleDate: { required: true, type: 'string' as const },
  saleMonth: { type: 'string' as const }, // optional → derived from saleDate
  saleNo: { type: 'string' as const, minLength: 1 }, // optional → auto-generated
}

// Validate a single item object (shared by create + update). Returns the normalized
// item, or an error string. qty: null/undefined → 0; must be a non-negative integer.
// unitPrice optional; if present must be a non-negative integer (whole rupiah).
function normalizeItem(
  raw: unknown,
  label: string,
): { voucherId: string; qty: number; unitPrice?: number } | string {
  if (typeof raw !== 'object' || raw === null) return `${label} must be an object`
  const { voucherId, qty, unitPrice } = raw as { voucherId?: unknown; qty?: unknown; unitPrice?: unknown }
  if (typeof voucherId !== 'string') return `${label}.voucherId must be a string`
  const resolvedQty: number = qty === null || qty === undefined ? 0 : (qty as number)
  if (!Number.isInteger(resolvedQty) || resolvedQty < 0) {
    return `${label}.qty must be a non-negative integer`
  }
  if (unitPrice !== undefined && unitPrice !== null) {
    if (!Number.isInteger(unitPrice as number) || (unitPrice as number) < 0) {
      return `${label}.unitPrice must be a non-negative integer`
    }
  }
  return {
    voucherId,
    qty: resolvedQty,
    unitPrice: unitPrice === undefined || unitPrice === null ? undefined : (unitPrice as number),
  }
}

export const resellerVoucherSaleController = {
  list: async (c: Context<Env>) => {
    const cursor = c.req.query('cursor') || undefined
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '20', 10)))
    const { items, nextCursor } = await resellerVoucherSaleService.getAll(c.env.DB, cursor, limit)
    return c.json({ success: true, data: items, meta: { nextCursor } })
  },

  getOne: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    const userId = c.get('user').userId
    const item = await resellerVoucherSaleService.getById(c.env.DB, c.env, id, userId)
    if (!item) {
      return response.error(c, 'Voucher sale not found', 404, 'RVS_NOT_FOUND')
    }
    return response.success(c, item)
  },

  // POST / — create draft sale { resellerId, saleDate, saleMonth?, saleNo?, items[{voucherId, qty, unitPrice?}] }
  create: async (c: Context<Env>) => {
    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, CREATE_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'RVS_VALIDATION_ERROR')
    }

    // Idempotency-Key (required, Stripe-style): prevents duplicate creates on retry.
    const idempotencyKey = c.req.header('Idempotency-Key')?.trim()
    if (!idempotencyKey || idempotencyKey.length === 0) {
      return response.error(c, 'Idempotency-Key header is required', 400, 'RVS_VALIDATION_ERROR')
    }
    if (idempotencyKey.length > 255) {
      return response.error(c, 'Idempotency-Key must be 1–255 characters', 400, 'RVS_VALIDATION_ERROR')
    }

    const saleDate = result.body.saleDate as string
    if (!SALE_DATE_REGEX.test(saleDate)) {
      return response.error(c, 'saleDate must be in YYYY-MM-DD format', 400, 'RVS_VALIDATION_ERROR')
    }

    // saleMonth: provided or derived from saleDate (YYYY-MM-DD → YYYY-MM).
    let saleMonth = result.body.saleMonth as string | undefined
    if (saleMonth === undefined) saleMonth = saleDate.slice(0, 7)
    if (!SALE_MONTH_REGEX.test(saleMonth)) {
      return response.error(c, 'saleMonth must be in YYYY-MM format', 400, 'RVS_VALIDATION_ERROR')
    }

    const rawItems = (body as { items?: unknown }).items
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return response.error(c, 'items must be a non-empty array', 400, 'RVS_VALIDATION_ERROR')
    }

    const items: { voucherId: string; qty: number; unitPrice?: number }[] = []
    const seen = new Set<string>()
    for (let i = 0; i < rawItems.length; i++) {
      const res = normalizeItem(rawItems[i], `items[${i}]`)
      if (typeof res === 'string') return response.error(c, res, 400, 'RVS_VALIDATION_ERROR')
      if (seen.has(res.voucherId)) {
        return response.error(c, `Duplicate voucher in items: ${res.voucherId}`, 400, 'RVS_VALIDATION_ERROR')
      }
      seen.add(res.voucherId)
      items.push(res)
    }

    for (const item of items) {
      if (!(await resellerVoucherSaleService._voucherExists(c.env.DB, item.voucherId))) {
        return response.error(c, `Voucher not found: ${item.voucherId}`, 400, 'RVS_VOUCHER_NOT_FOUND')
      }
    }

    // Only provided (manual/retroactive) numbers need a uniqueness check — generated
    // numbers are unique by construction (atomic sequence).
    const saleNo = result.body.saleNo as string | undefined
    if (saleNo !== undefined && (await resellerVoucherSaleService._saleNoExists(c.env.DB, saleNo))) {
      return response.error(c, 'saleNo already exists', 409, 'RVS_SALE_NO_EXISTS')
    }

    const userId = c.get('user').userId
    try {
      const { id, replayed } = await resellerVoucherSaleService.create(
        c.env.DB,
        { saleDate, saleMonth, saleNo, items },
        userId,
        idempotencyKey,
      )
      return c.json({ success: true, data: { id } }, replayed ? 200 : 201)
    } catch (err: any) {
      if (err?.code === 'CG_NO_CONFIG') {
        return response.error(c, 'Sale code config not found (seed incremental_code_configs for "sale")', 500, 'CG_NO_CONFIG')
      }
      throw err
    }
  },

  // PATCH /:id — edit (draft only). Header fields partial AND/OR items full-replace.
  update: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, {
      saleDate: { type: 'string' as const },
      saleMonth: { type: 'string' as const },
      saleNo: { type: 'string' as const, minLength: 1 },
    })
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'RVS_VALIDATION_ERROR')
    }

    const fields: { saleDate?: string; saleMonth?: string; saleNo?: string } = {}
    if (result.body.saleDate !== undefined) {
      const sd = result.body.saleDate as string
      if (!SALE_DATE_REGEX.test(sd)) {
        return response.error(c, 'saleDate must be in YYYY-MM-DD format', 400, 'RVS_VALIDATION_ERROR')
      }
      fields.saleDate = sd
    }
    if (result.body.saleMonth !== undefined) {
      const sm = result.body.saleMonth as string
      if (!SALE_MONTH_REGEX.test(sm)) {
        return response.error(c, 'saleMonth must be in YYYY-MM format', 400, 'RVS_VALIDATION_ERROR')
      }
      fields.saleMonth = sm
    }
    if (result.body.saleNo !== undefined) fields.saleNo = result.body.saleNo as string

    // Items (optional; if present = full list replace).
    let items: { voucherId: string; qty: number; unitPrice?: number }[] | undefined
    if ((body as { items?: unknown }).items !== undefined) {
      const rawItems = (body as { items?: unknown }).items
      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return response.error(c, 'items must be a non-empty array', 400, 'RVS_VALIDATION_ERROR')
      }
      items = []
      const seen = new Set<string>()
      for (let i = 0; i < rawItems.length; i++) {
        const res = normalizeItem(rawItems[i], `items[${i}]`)
        if (typeof res === 'string') return response.error(c, res, 400, 'RVS_VALIDATION_ERROR')
        if (seen.has(res.voucherId)) {
          return response.error(c, `Duplicate voucher in items: ${res.voucherId}`, 400, 'RVS_VALIDATION_ERROR')
        }
        seen.add(res.voucherId)
        items.push(res)
      }
      for (const item of items) {
        if (!(await resellerVoucherSaleService._voucherExists(c.env.DB, item.voucherId))) {
          return response.error(c, `Voucher not found: ${item.voucherId}`, 400, 'RVS_VOUCHER_NOT_FOUND')
        }
      }
    }

    if (Object.keys(fields).length === 0 && items === undefined) {
      return response.error(c, 'No updatable fields provided', 400, 'RVS_VALIDATION_ERROR')
    }

    // FK checks for changed header values.
    if (fields.saleNo !== undefined && (await resellerVoucherSaleService._saleNoExists(c.env.DB, fields.saleNo, id))) {
      return response.error(c, 'saleNo already exists', 409, 'RVS_SALE_NO_EXISTS')
    }

    const userId = c.get('user').userId
    const updated = await resellerVoucherSaleService.update(c.env.DB, id, { ...fields, items }, userId)
    if (!updated) {
      return response.error(c, 'Sale not found or not in draft status', 409, 'RVS_INVALID_TRANSITION')
    }
    return response.noContent(c, 204)
  },

  // POST /:id/complete — draft → completed (allocates codes from the pool, sub-district scoped).
  complete: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    const userId = c.get('user').userId
    try {
      const completed = await resellerVoucherSaleService.complete(c.env.DB, id, userId)
      if (!completed) {
        return response.error(c, 'Sale not found or not in draft status', 409, 'RVS_INVALID_TRANSITION')
      }
      return response.noContent(c, 204)
    } catch (err: any) {
      if (err instanceof SaleError && err.code === 'SALE_INSUFFICIENT_STOCK') {
        return response.error(c, err.message, 409, 'RVS_INSUFFICIENT_STOCK')
      }
      throw err
    }
  },

  // POST /:id/cancel — draft → cancelled only. Non-draft sales are terminal and cannot be
  // cancelled (no completed→cancelled reverse-allocation).
  cancel: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    const userId = c.get('user').userId
    const cancelled = await resellerVoucherSaleService.cancel(c.env.DB, id, userId)
    if (!cancelled) {
      return response.error(c, 'Sale not found or not in draft status', 409, 'RVS_INVALID_TRANSITION')
    }
    return response.noContent(c, 204)
  },

  remove: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    const userId = c.get('user').userId
    const deleted = await resellerVoucherSaleService.remove(c.env.DB, id, userId)
    if (!deleted) {
      return response.error(c, 'Sale not found or not in draft status', 404, 'RVS_NOT_FOUND')
    }
    return response.noContent(c, 204)
  },

  // GET /:id/logs — audit trail.
  logs: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    const sale = await resellerVoucherSaleService._getFull(c.env.DB, id)
    if (!sale) {
      return response.error(c, 'Voucher sale not found', 404, 'RVS_NOT_FOUND')
    }
    const logs = await resellerVoucherSaleService.getLogs(c.env.DB, id)
    return response.success(c, logs)
  },
}
