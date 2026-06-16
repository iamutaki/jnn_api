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

    // Check name uniqueness
    const nameExists = await districtService._nameExists(c.env.DB, result.body.name as string)
    if (nameExists) {
      return response.error(c, 'Name already exists', 409, 'DISTRICT_NAME_EXISTS')
    }

    await districtService.create(c.env.DB, result.body as any)
    return response.noContent(c, 201)
  },

  update: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''

    if (id === districtService.GLOBAL_DISTRICT_ID) {
      return response.error(c, 'Cannot edit Global district', 403, 'DISTRICT_PROTECTED')
    }

    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, UPDATE_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'DISTRICT_VALIDATION_ERROR')
    }

    // Check name uniqueness (exclude self)
    if (result.body.name !== undefined) {
      const nameExists = await districtService._nameExists(c.env.DB, result.body.name as string, id)
      if (nameExists) {
        return response.error(c, 'Name already exists', 409, 'DISTRICT_NAME_EXISTS')
      }
    }

    const updated = await districtService.update(c.env.DB, id, result.body as any)

    if (!updated) {
      return response.error(c, 'District not found', 404, 'DISTRICT_NOT_FOUND')
    }

    return response.noContent(c, 204)
  },

  remove: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''

    if (id === districtService.GLOBAL_DISTRICT_ID) {
      return response.error(c, 'Cannot delete Global district', 403, 'DISTRICT_PROTECTED')
    }

    const existing = await districtService._getFull(c.env.DB, id)
    if (!existing) {
      return response.error(c, 'District not found', 404, 'DISTRICT_NOT_FOUND')
    }

    const hasSubDistricts = await districtService._hasSubDistricts(c.env.DB, id)
    if (hasSubDistricts) {
      return response.error(c, 'Cannot delete district with existing sub-districts. Remove all sub-districts first.', 409, 'DISTRICT_HAS_SUB_DISTRICTS')
    }

    await districtService.remove(c.env.DB, id)
    return response.noContent(c, 204)
  },
}
