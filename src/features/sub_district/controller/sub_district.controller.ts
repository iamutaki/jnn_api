import type { Context } from 'hono'
import { response } from '../../../lib/response'
import { safeJsonBody } from '../../../lib/request'
import { validate } from '../../../lib/validation'
import type { Env } from '../../../types'
import { subDistrictService } from '../service/sub_district.service'

const CREATE_SCHEMA = {
  district_id: { required: true, type: 'string' as const },
  name: { required: true, type: 'string' as const, minLength: 2 },
  code: { type: 'string' as const },
  lat: { type: 'number' as const },
  lng: { type: 'number' as const },
}

const UPDATE_SCHEMA = {
  district_id: { type: 'string' as const },
  name: { type: 'string' as const, minLength: 2 },
  code: { type: 'string' as const },
  lat: { type: 'number' as const },
  lng: { type: 'number' as const },
}

export const subDistrictController = {
  list: async (c: Context<Env>) => {
    const items = await subDistrictService.getAll(c.env.DB)
    return response.success(c, items)
  },

  getOne: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    const item = await subDistrictService.getById(c.env.DB, id)

    if (!item) {
      return response.error(c, 'Sub-district not found', 404, 'SUB_DISTRICT_NOT_FOUND')
    }

    return response.success(c, item)
  },

  create: async (c: Context<Env>) => {
    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, CREATE_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'SUB_DISTRICT_VALIDATION_ERROR')
    }

    // Verify district_id exists
    const exists = await subDistrictService._districtExists(c.env.DB, body.district_id as string)
    if (!exists) {
      return response.error(c, 'District not found', 400, 'SUB_DISTRICT_DISTRICT_NOT_FOUND')
    }

    await subDistrictService.create(c.env.DB, body as any)
    return response.noContent(c, 201)
  },

  update: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''

    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, UPDATE_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'SUB_DISTRICT_VALIDATION_ERROR')
    }

    // If district_id is being updated, verify it exists
    if (body.district_id !== undefined) {
      const exists = await subDistrictService._districtExists(c.env.DB, body.district_id as string)
      if (!exists) {
        return response.error(c, 'District not found', 400, 'SUB_DISTRICT_DISTRICT_NOT_FOUND')
      }
    }

    const updated = await subDistrictService.update(c.env.DB, id, body as any)

    if (!updated) {
      return response.error(c, 'Sub-district not found', 404, 'SUB_DISTRICT_NOT_FOUND')
    }

    return response.noContent(c, 204)
  },

  remove: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    const deleted = await subDistrictService.remove(c.env.DB, id)

    if (!deleted) {
      return response.error(c, 'Sub-district not found', 404, 'SUB_DISTRICT_NOT_FOUND')
    }

    return response.noContent(c, 204)
  },
}
