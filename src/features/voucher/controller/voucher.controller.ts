import type { Context } from 'hono'
import { response } from '../../../lib/response'
import { safeJsonBody } from '../../../lib/request'
import { validate } from '../../../lib/validation'
import type { Env } from '../../../types'
import { voucherService } from '../service/voucher.service'

const CREATE_SCHEMA = {
  name: { required: true, type: 'string' as const, minLength: 2 },
  price: { required: true, type: 'number' as const },
  description: { type: 'string' as const },
}

const UPDATE_SCHEMA = {
  name: { type: 'string' as const, minLength: 2 },
  price: { type: 'number' as const },
  description: { type: 'string' as const },
}

export const voucherController = {
  list: async (c: Context<Env>) => {
    const items = await voucherService.getAll(c.env.DB)
    return response.success(c, items)
  },

  getOne: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    const item = await voucherService.getById(c.env.DB, id)

    if (!item) {
      return response.error(c, 'Voucher tidak ditemukan', 404, 'VOUCHER_NOT_FOUND')
    }

    return response.success(c, item)
  },

  create: async (c: Context<Env>) => {
    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, CREATE_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'VOUCHER_VALIDATION_ERROR')
    }

    if (!Number.isInteger(result.body.price)) {
      return response.error(c, 'Harga harus berupa angka bulat', 400, 'VOUCHER_VALIDATION_ERROR')
    }

    const nameExists = await voucherService._nameExists(c.env.DB, result.body.name as string)
    if (nameExists) {
      return response.error(c, 'Nama sudah digunakan', 409, 'VOUCHER_NAME_EXISTS')
    }

    await voucherService.create(c.env.DB, result.body as any)
    return response.noContent(c, 201)
  },

  update: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''

    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, UPDATE_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'VOUCHER_VALIDATION_ERROR')
    }

    if (result.body.price !== undefined && !Number.isInteger(result.body.price)) {
      return response.error(c, 'Harga harus berupa angka bulat', 400, 'VOUCHER_VALIDATION_ERROR')
    }

    if (result.body.name !== undefined) {
      const nameExists = await voucherService._nameExists(c.env.DB, result.body.name as string, id)
      if (nameExists) {
        return response.error(c, 'Nama sudah digunakan', 409, 'VOUCHER_NAME_EXISTS')
      }
    }

    const updated = await voucherService.update(c.env.DB, id, result.body as any)

    if (!updated) {
      return response.error(c, 'Voucher tidak ditemukan', 404, 'VOUCHER_NOT_FOUND')
    }

    return response.noContent(c, 204)
  },

  remove: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''

    const existing = await voucherService._getFull(c.env.DB, id)
    if (!existing) {
      return response.error(c, 'Voucher tidak ditemukan', 404, 'VOUCHER_NOT_FOUND')
    }

    const linked = await voucherService._linkedToSubDistricts(c.env.DB, id)
    if (linked) {
      return response.error(c, 'Hapus semua penempatan voucher terlebih dahulu', 409, 'VOUCHER_HAS_SUB_DISTRICTS')
    }

    await voucherService.remove(c.env.DB, id)
    return response.noContent(c, 204)
  },
}
