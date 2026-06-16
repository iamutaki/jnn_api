import type { Context } from 'hono'
import { response } from '../../../lib/response'
import { safeJsonBody } from '../../../lib/request'
import type { Env } from '../../../types'
import { digitalVoucherService } from '../service/digital_voucher.service'

function validateItem(raw: unknown, label = 'item'): { voucherId: string; subDistrictId?: string | null; code: string } | string {
  if (typeof raw !== 'object' || raw === null) return `${label} must be an object`
  const { voucherId, subDistrictId, code } = raw as { voucherId?: unknown; subDistrictId?: unknown; code?: unknown }
  if (typeof voucherId !== 'string') return `${label}.voucherId must be a string`
  if (subDistrictId !== undefined && subDistrictId !== null && typeof subDistrictId !== 'string') {
    return `${label}.subDistrictId must be a string`
  }
  if (typeof code !== 'string' || code.length === 0) return `${label}.code must be a non-empty string`
  return { voucherId, subDistrictId: (subDistrictId as string) ?? null, code }
}

export const digitalVoucherController = {
  list: async (c: Context<Env>) => {
    const items = await digitalVoucherService.getAll(c.env.DB)
    return response.success(c, items)
  },

  listImports: async (c: Context<Env>) => {
    const cursor = c.req.query('cursor') || undefined
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '20', 10)))
    const { items, nextCursor } = await digitalVoucherService.getImports(c.env.DB, cursor, limit)
    return c.json({ success: true, data: items, meta: { nextCursor } })
  },

  getOne: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    try {
      const item = await digitalVoucherService.getById(c.env.DB, c.env, id, c.get('user').userId)
      if (!item) {
        return response.error(c, 'Digital voucher not found', 404, 'DV_NOT_FOUND')
      }
      return response.success(c, item)
    } catch (err: any) {
      if (err?.code === 'DV_FORBIDDEN') {
        return response.error(c, err.message, 403, 'DV_FORBIDDEN')
      }
      throw err
    }
  },

  // GET /by-code?code=... — lookup by plaintext code (redemption helper).
  getByCode: async (c: Context<Env>) => {
    const code = c.req.query('code') ?? ''
    if (code.length === 0) {
      return response.error(c, 'code query param is required', 400, 'DV_VALIDATION_ERROR')
    }
    const item = await digitalVoucherService.getByCode(c.env.DB, c.env, code)
    if (!item) {
      return response.error(c, 'Digital voucher not found', 404, 'DV_NOT_FOUND')
    }
    return response.success(c, item)
  },

  create: async (c: Context<Env>) => {
    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const checked = validateItem(body)
    if (typeof checked === 'string') {
      return response.error(c, checked, 400, 'DV_VALIDATION_ERROR')
    }

    if (!(await digitalVoucherService._voucherExists(c.env.DB, checked.voucherId))) {
      return response.error(c, 'Voucher not found', 400, 'DV_VOUCHER_NOT_FOUND')
    }
    if (checked.subDistrictId && !(await digitalVoucherService._subDistrictExists(c.env.DB, checked.subDistrictId))) {
      return response.error(c, 'Sub district not found', 400, 'DV_SUB_DISTRICT_NOT_FOUND')
    }

    try {
      const userId = c.get('user').userId
      const result = await digitalVoucherService.createSingle(c.env.DB, c.env, checked, userId)
      return response.success(c, { id: result.id, importId: result.importId })
    } catch (err: any) {
      if (err?.code === 'DV_CODE_EXISTS') {
        return response.error(c, 'Code already exists (available)', 409, 'DV_CODE_EXISTS')
      }
      throw err
    }
  },

  // POST /bulk — { items: [{ voucherId, subDistrictId?, code }, ...] }
  createBulk: async (c: Context<Env>) => {
    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const items = (body as any)?.items
    if (!Array.isArray(items) || items.length === 0) {
      return response.error(c, 'items must be a non-empty array', 400, 'DV_VALIDATION_ERROR')
    }

    const checked: { voucherId: string; subDistrictId?: string | null; code: string }[] = []
    for (let i = 0; i < items.length; i++) {
      const res = validateItem(items[i], `items[${i}]`)
      if (typeof res === 'string') return response.error(c, res, 400, 'DV_VALIDATION_ERROR')
      checked.push(res)
    }

    // FK checks (unique voucherIds / subDistrictIds only).
    const voucherIds = [...new Set(checked.map((i) => i.voucherId))]
    for (const vid of voucherIds) {
      if (!(await digitalVoucherService._voucherExists(c.env.DB, vid))) {
        return response.error(c, `Voucher not found: ${vid}`, 400, 'DV_VOUCHER_NOT_FOUND')
      }
    }
    const subDistrictIds = [...new Set(checked.map((i) => i.subDistrictId).filter((x): x is string => !!x))]
    for (const sid of subDistrictIds) {
      if (!(await digitalVoucherService._subDistrictExists(c.env.DB, sid))) {
        return response.error(c, `Sub district not found: ${sid}`, 400, 'DV_SUB_DISTRICT_NOT_FOUND')
      }
    }

    const userId = c.get('user').userId
    const result = await digitalVoucherService.createBulk(c.env.DB, c.env, checked, userId)
    return response.success(c, { created: result.count, skipped: result.skipped, importIds: result.importIds })
  },

  remove: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    const userId = c.get('user').userId
    const deleted = await digitalVoucherService.remove(c.env.DB, id, userId)
    if (!deleted) {
      return response.error(c, 'Digital voucher not found', 404, 'DV_NOT_FOUND')
    }
    return response.noContent(c, 204)
  },
}
