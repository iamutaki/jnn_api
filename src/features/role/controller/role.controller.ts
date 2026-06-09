import type { Context } from 'hono'
import { response } from '../../../lib/response'
import { safeJsonBody } from '../../../lib/request'
import { validate } from '../../../lib/validation'
import type { Env } from '../../../types'
import { roleService } from '../service/role.service'

const CREATE_SCHEMA = {
  name: { required: true, type: 'string' as const, minLength: 1 },
  description: { type: 'string' as const },
}

const UPDATE_SCHEMA = {
  name: { type: 'string' as const, minLength: 1 },
  description: { type: 'string' as const },
}

export const roleController = {
  list: async (c: Context<Env>) => {
    const items = await roleService.getAll(c.env.DB)
    return response.success(c, items)
  },

  getOne: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    const item = await roleService.getById(c.env.DB, id)

    if (!item) {
      return response.error(c, 'Role not found', 404, 'ROLE_NOT_FOUND')
    }

    return response.success(c, item)
  },

  create: async (c: Context<Env>) => {
    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, CREATE_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'ROLE_VALIDATION_ERROR')
    }

    const nameExists = await roleService._nameExists(c.env.DB, result.body.name as string)
    if (nameExists) {
      return response.error(c, 'Name already exists', 409, 'ROLE_NAME_EXISTS')
    }

    await roleService.create(c.env.DB, result.body as any)
    return response.noContent(c, 201)
  },

  update: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''

    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, UPDATE_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'ROLE_VALIDATION_ERROR')
    }

    if (result.body.name !== undefined) {
      const nameExists = await roleService._nameExists(c.env.DB, result.body.name as string, id)
      if (nameExists) {
        return response.error(c, 'Name already exists', 409, 'ROLE_NAME_EXISTS')
      }
    }

    const updated = await roleService.update(c.env.DB, id, result.body as any)

    if (!updated) {
      return response.error(c, 'Role not found', 404, 'ROLE_NOT_FOUND')
    }

    return response.noContent(c, 204)
  },

  remove: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    const deleted = await roleService.remove(c.env.DB, id)

    if (!deleted) {
      return response.error(c, 'Role not found', 404, 'ROLE_NOT_FOUND')
    }

    return response.noContent(c, 204)
  },
}
