import type { Context } from 'hono'
import { response } from '../../../lib/response'
import { safeJsonBody } from '../../../lib/request'
import { validate } from '../../../lib/validation'
import type { Env } from '../../../types'
import { userService } from '../service/user.service'

const CREATE_SCHEMA = {
  username: { required: true, type: 'string' as const, minLength: 1 },
  password: { required: true, type: 'string' as const, minLength: 6 },
  name: { required: true, type: 'string' as const, minLength: 1 },
  phone: { type: 'string' as const },
  email: { type: 'string' as const },
  address: { type: 'string' as const },
  avatar: { type: 'string' as const },
}

const UPDATE_SCHEMA = {
  username: { type: 'string' as const },
  password: { type: 'string' as const, minLength: 6 },
  name: { type: 'string' as const, minLength: 1 },
  phone: { type: 'string' as const },
  email: { type: 'string' as const },
  address: { type: 'string' as const },
  avatar: { type: 'string' as const },
}

async function checkUniqueFields(c: Context<Env>, body: Record<string, unknown>, excludeId?: string): Promise<Response | null> {
  const uniqueFields = ['username', 'email', 'phone'] as const
  for (const field of uniqueFields) {
    const value = body[field]
    if (value !== undefined && value !== null && value !== '') {
      const exists = await userService._fieldExists(c.env.DB, field, value as string, excludeId)
      if (exists) {
        const key = field.charAt(0).toUpperCase() + field.slice(1)
        return response.error(c, `${key} already exists`, 409, `USER_${field.toUpperCase()}_EXISTS`)
      }
    }
  }
  return null
}

export const userController = {
  list: async (c: Context<Env>) => {
    const items = await userService.getAll(c.env.DB)
    return response.success(c, items)
  },

  getOne: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    const item = await userService.getById(c.env.DB, id)

    if (!item) {
      return response.error(c, 'User not found', 404, 'USER_NOT_FOUND')
    }

    return response.success(c, item)
  },

  create: async (c: Context<Env>) => {
    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, CREATE_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'USER_VALIDATION_ERROR')
    }

    const conflict = await checkUniqueFields(c, result.body)
    if (conflict) return conflict

    await userService.create(c.env.DB, result.body as any)
    return response.noContent(c, 201)
  },

  update: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''

    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, UPDATE_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'USER_VALIDATION_ERROR')
    }

    const conflict = await checkUniqueFields(c, result.body, id)
    if (conflict) return conflict

    const updated = await userService.update(c.env.DB, id, result.body as any)

    if (!updated) {
      return response.error(c, 'User not found', 404, 'USER_NOT_FOUND')
    }

    return response.noContent(c, 204)
  },

  remove: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    const deleted = await userService.remove(c.env.DB, id)

    if (!deleted) {
      return response.error(c, 'User not found', 404, 'USER_NOT_FOUND')
    }

    return response.noContent(c, 204)
  },
}
