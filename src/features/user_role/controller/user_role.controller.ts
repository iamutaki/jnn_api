import type { Context } from 'hono'
import { response } from '../../../lib/response'
import { safeJsonBody } from '../../../lib/request'
import { validate } from '../../../lib/validation'
import type { Env } from '../../../types'
import { userRoleService } from '../service/user_role.service'

const ASSIGN_SCHEMA = {
  userId: { required: true, type: 'string' as const },
}

const ROLE_IDS_KEY = 'roleIds'

export const userRoleController = {
  listUserRoles: async (c: Context<Env>) => {
    const userId = c.req.param('userId') ?? ''

    const userExists = await userRoleService.userExists(c.env.DB, userId)
    if (!userExists) {
      return response.error(c, 'User not found', 404, 'USER_NOT_FOUND')
    }

    const roles = await userRoleService.getRolesForUser(c.env.DB, userId)
    return response.success(c, roles)
  },

  listRoleUsers: async (c: Context<Env>) => {
    const roleId = c.req.param('roleId') ?? ''

    const roleExists = await userRoleService.roleExists(c.env.DB, roleId)
    if (!roleExists) {
      return response.error(c, 'Role not found', 404, 'ROLE_NOT_FOUND')
    }

    const users = await userRoleService.getUsersForRole(c.env.DB, roleId)
    return response.success(c, users)
  },

  assign: async (c: Context<Env>) => {
    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, ASSIGN_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'USER_ROLE_VALIDATION_ERROR')
    }

    const roleIds = body[ROLE_IDS_KEY]
    if (!Array.isArray(roleIds) || roleIds.length === 0) {
      return response.error(c, 'roleIds must be a non-empty array', 400, 'USER_ROLE_VALIDATION_ERROR')
    }
    if (!roleIds.every((id: unknown) => typeof id === 'string' && (id as string).trim().length > 0)) {
      return response.error(c, 'roleIds must only contain non-empty strings', 400, 'USER_ROLE_VALIDATION_ERROR')
    }

    const { userId } = result.body as { userId: string }

    const userExists = await userRoleService.userExists(c.env.DB, userId)
    if (!userExists) {
      return response.error(c, 'User not found', 404, 'USER_NOT_FOUND')
    }

    const { allExist, missing } = await userRoleService.roleIdsExist(c.env.DB, roleIds)
    if (!allExist) {
      return response.error(c, `Roles not found: ${missing.join(', ')}`, 400, 'USER_ROLE_ROLE_NOT_FOUND')
    }

    const assigned = await userRoleService.assign(c.env.DB, userId, roleIds)
    return response.success(c, { assigned })
  },

  remove: async (c: Context<Env>) => {
    const userId = c.req.param('userId') ?? ''
    const roleId = c.req.param('roleId') ?? ''

    const removed = await userRoleService.remove(c.env.DB, userId, roleId)
    if (!removed) {
      return response.error(c, 'User does not have this role', 404, 'USER_ROLE_NOT_FOUND')
    }

    return response.noContent(c, 204)
  },
}
