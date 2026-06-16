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
  name: { type: 'string' as const, minLength: 1 },
  phone: { type: 'string' as const },
  email: { type: 'string' as const },
  address: { type: 'string' as const },
  avatar: { type: 'string' as const },
}

function validateRoleIds(body: Record<string, unknown>): string[] | null {
  const roleIds = body.roleIds
  if (roleIds === undefined || roleIds === null) return []
  if (!Array.isArray(roleIds)) return null
  for (const id of roleIds) {
    if (typeof id !== 'string' || id.length === 0) return null
  }
  return roleIds as string[]
}

async function checkRolesExist(db: D1Database, ids: string[]): Promise<string | null> {
  if (ids.length === 0) return null
  const placeholders = ids.map(() => '?').join(',')
  const result = await db.prepare(`SELECT id FROM roles WHERE id IN (${placeholders})`).bind(...ids).all<{ id: string }>()
  const found = new Set(result.results.map(r => r.id))
  const missing = ids.filter(id => !found.has(id))
  if (missing.length > 0) return 'Role tidak ditemukan'
  return null
}

async function checkUniqueFields(c: Context<Env>, body: Record<string, unknown>, excludeId?: string): Promise<Response | null> {
  const uniqueFields = ['username', 'email', 'phone'] as const
  for (const field of uniqueFields) {
    const value = body[field]
    if (value !== undefined && value !== null && value !== '') {
      const exists = await userService._fieldExists(c.env.DB, field, value as string, excludeId)
      if (exists) {
        const key = field.charAt(0).toUpperCase() + field.slice(1)
        return response.error(c, `${key} sudah digunakan`, 409, `USER_${field.toUpperCase()}_EXISTS`)
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
      return response.error(c, 'Pengguna tidak ditemukan', 404, 'USER_NOT_FOUND')
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

    const roleIds = validateRoleIds(result.body)
    if (roleIds === null) {
      return response.error(c, 'roleIds harus berupa daftar teks', 400, 'USER_VALIDATION_ERROR')
    }

    const roleErr = await checkRolesExist(c.env.DB, roleIds)
    if (roleErr) {
      return response.error(c, 'Role tidak ditemukan', 400, 'USER_VALIDATION_ERROR')
    }

    await userService.create(c.env.DB, result.body as any, roleIds)
    return response.noContent(c, 201)
  },

  update: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''

    if (id === userService.SYSTEM_USER_ID) {
      return response.error(c, 'Tidak bisa mengubah pengguna System', 403, 'USER_PROTECTED')
    }

    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, UPDATE_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'USER_VALIDATION_ERROR')
    }

    const password = body.password
    if (password !== undefined && password !== null) {
      if (typeof password !== 'string' || password.length < 6) {
        return response.error(c, 'Password minimal 6 karakter', 400, 'USER_VALIDATION_ERROR')
      }
    }

    const conflict = await checkUniqueFields(c, result.body, id)
    if (conflict) return conflict

    const roleIds = validateRoleIds(result.body)
    if (roleIds === null) {
      return response.error(c, 'roleIds harus berupa daftar teks', 400, 'USER_VALIDATION_ERROR')
    }

    const roleErr = await checkRolesExist(c.env.DB, roleIds)
    if (roleErr) {
      return response.error(c, 'Role tidak ditemukan', 400, 'USER_VALIDATION_ERROR')
    }

    const updated = await userService.update(c.env.DB, id, result.body as any, roleIds)

    if (!updated) {
      return response.error(c, 'Pengguna tidak ditemukan', 404, 'USER_NOT_FOUND')
    }

    return response.noContent(c, 204)
  },

  remove: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''

    if (id === userService.SYSTEM_USER_ID) {
      return response.error(c, 'Tidak bisa menghapus pengguna System', 403, 'USER_PROTECTED')
    }

    const deleted = await userService.remove(c.env.DB, id)

    if (!deleted) {
      return response.error(c, 'Pengguna tidak ditemukan', 404, 'USER_NOT_FOUND')
    }

    return response.noContent(c, 204)
  },
}
