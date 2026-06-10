import type { Context } from 'hono'
import { response } from '../../../lib/response'
import { safeJsonBody } from '../../../lib/request'
import { validate } from '../../../lib/validation'
import type { Env } from '../../../types'
import { resellerService } from '../service/reseller.service'

const CREATE_SCHEMA = {
  name: { required: true, type: 'string' as const, minLength: 2 },
  username: { required: true, type: 'string' as const, minLength: 4 },
  password: { required: true, type: 'string' as const, minLength: 6 },
  phone: { type: 'string' as const },
  avatar: { type: 'string' as const },
  venuePhoto: { type: 'string' as const },
  subDistrictId: { required: true, type: 'string' as const },
  commissionRate: { type: 'number' as const },
  commissionAmount: { type: 'number' as const },
  lat: { type: 'number' as const },
  lng: { type: 'number' as const },
}

const URL_REGEX = /^https?:\/\/.+/

function validateResellerFields(body: Record<string, unknown>): string | null {
  const avatar = body.avatar as string | undefined
  if (avatar !== undefined && !URL_REGEX.test(avatar)) {
    return 'Avatar must be a valid URL'
  }
  const venuePhoto = body.venuePhoto as string | undefined
  if (venuePhoto !== undefined && !URL_REGEX.test(venuePhoto)) {
    return 'Venue photo must be a valid URL'
  }
  const cr = body.commissionRate as number | undefined
  if (cr !== undefined && (cr < 0 || cr > 100)) {
    return 'Commission rate must be between 0 and 100'
  }
  const ca = body.commissionAmount as number | undefined
  if (ca !== undefined && (!Number.isInteger(ca) || ca < 0)) {
    return 'Commission amount must be an unsigned integer'
  }
  return null
}

const UPDATE_SCHEMA = {
  name: { type: 'string' as const, minLength: 2 },
  username: { type: 'string' as const, minLength: 4 },
  phone: { type: 'string' as const },
  avatar: { type: 'string' as const },
  venuePhoto: { type: 'string' as const },
  subDistrictId: { type: 'string' as const },
  commissionRate: { type: 'number' as const },
  commissionAmount: { type: 'number' as const },
  lat: { type: 'number' as const },
  lng: { type: 'number' as const },
}

export const resellerController = {
  list: async (c: Context<Env>) => {
    const items = await resellerService.getAll(c.env.DB)
    return response.success(c, items)
  },

  getOne: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    const item = await resellerService.getById(c.env.DB, id)

    if (!item) {
      return response.error(c, 'Reseller not found', 404, 'RESELLER_NOT_FOUND')
    }

    return response.success(c, item)
  },

  create: async (c: Context<Env>) => {
    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, CREATE_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'RESELLER_VALIDATION_ERROR')
    }

    const username = result.body.username as string
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      return response.error(c, 'Username must be alphanumeric', 400, 'RESELLER_VALIDATION_ERROR')
    }

    const phone = result.body.phone as string | undefined
    if (phone !== undefined && !/^\d+$/.test(phone)) {
      return response.error(c, 'Phone must be numeric', 400, 'RESELLER_VALIDATION_ERROR')
    }

    if (await resellerService._fieldExists(c.env.DB, 'username', username)) {
      return response.error(c, 'Username already exists', 409, 'RESELLER_USERNAME_EXISTS')
    }

    if (phone && await resellerService._fieldExists(c.env.DB, 'phone', phone)) {
      return response.error(c, 'Phone already exists', 409, 'RESELLER_PHONE_EXISTS')
    }

    const fieldErr = validateResellerFields(result.body)
    if (fieldErr) {
      return response.error(c, fieldErr, 400, 'RESELLER_VALIDATION_ERROR')
    }

    const sdId = result.body.subDistrictId as string
    if (!(await resellerService._subDistrictExists(c.env.DB, sdId))) {
      return response.error(c, 'Sub-district not found', 400, 'RESELLER_SUB_DISTRICT_NOT_FOUND')
    }

    await resellerService.create(c.env.DB, result.body as any)
    return response.noContent(c, 201)
  },

  update: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''

    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const password = body.password
    if (password !== undefined && password !== null) {
      if (typeof password !== 'string' || password.length < 6) {
        return response.error(c, 'Password must be at least 6 characters', 400, 'RESELLER_VALIDATION_ERROR')
      }
    }

    const result = validate(body, UPDATE_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'RESELLER_VALIDATION_ERROR')
    }

    const username = result.body.username as string | undefined
    if (username !== undefined && !/^[a-zA-Z0-9]+$/.test(username)) {
      return response.error(c, 'Username must be alphanumeric', 400, 'RESELLER_VALIDATION_ERROR')
    }

    const phone = result.body.phone as string | undefined
    if (phone !== undefined && !/^\d+$/.test(phone)) {
      return response.error(c, 'Phone must be numeric', 400, 'RESELLER_VALIDATION_ERROR')
    }

    if (username && await resellerService._fieldExists(c.env.DB, 'username', username, id)) {
      return response.error(c, 'Username already exists', 409, 'RESELLER_USERNAME_EXISTS')
    }

    if (phone && await resellerService._fieldExists(c.env.DB, 'phone', phone, id)) {
      return response.error(c, 'Phone already exists', 409, 'RESELLER_PHONE_EXISTS')
    }

    const fieldErr = validateResellerFields(result.body)
    if (fieldErr) {
      return response.error(c, fieldErr, 400, 'RESELLER_VALIDATION_ERROR')
    }

    const sdId = result.body.subDistrictId as string | undefined
    if (sdId && !(await resellerService._subDistrictExists(c.env.DB, sdId))) {
      return response.error(c, 'Sub-district not found', 400, 'RESELLER_SUB_DISTRICT_NOT_FOUND')
    }

    const updated = await resellerService.update(c.env.DB, id, result.body as any)

    if (!updated) {
      return response.error(c, 'Reseller not found', 404, 'RESELLER_NOT_FOUND')
    }

    return response.noContent(c, 204)
  },

  remove: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    const deleted = await resellerService.remove(c.env.DB, id)

    if (!deleted) {
      return response.error(c, 'Reseller not found', 404, 'RESELLER_NOT_FOUND')
    }

    return response.noContent(c, 204)
  },
}
