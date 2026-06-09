import type { Context } from 'hono'
import { response } from '../../../lib/response'
import { safeJsonBody } from '../../../lib/request'
import { validate } from '../../../lib/validation'
import type { Env } from '../../../types'
import { districtService } from '../service/district.service'

const CREATE_SCHEMA = {
  name: { required: true, type: 'string' as const, minLength: 1 },
  code: { type: 'string' as const },
  lat: { type: 'number' as const },
  lng: { type: 'number' as const },
}

const UPDATE_SCHEMA = {
  name: { type: 'string' as const, minLength: 1 },
  code: { type: 'string' as const },
  lat: { type: 'number' as const },
  lng: { type: 'number' as const },
}

export const districtController = {
  list: async (c: Context<Env>) => {
    const items = await districtService.getAll(c.env.DB)
    return response.success(c, items)
  },

  getOne: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    const item = await districtService.getById(c.env.DB, id)

    if (!item) {
      return response.error(c, 'District not found', 404, 'DISTRICT_NOT_FOUND')
    }

    return response.success(c, item)
  },

  create: async (c: Context<Env>) => {
    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, CREATE_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'DISTRICT_VALIDATION_ERROR')
    }

    const item = await districtService.create(c.env.DB, body as any)
    return response.success(c, item, 201)
  },

  update: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''

    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, UPDATE_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'DISTRICT_VALIDATION_ERROR')
    }

    const item = await districtService.update(c.env.DB, id, body as any)

    if (!item) {
      return response.error(c, 'District not found', 404, 'DISTRICT_NOT_FOUND')
    }

    return response.success(c, item)
  },

  remove: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    const deleted = await districtService.remove(c.env.DB, id)

    if (!deleted) {
      return response.error(c, 'District not found', 404, 'DISTRICT_NOT_FOUND')
    }

    return response.success(c, { message: 'District deleted' })
  },
}
