import type { Context } from 'hono'
import { response } from '../../../lib/response'
import { safeJsonBody } from '../../../lib/request'
import { validate } from '../../../lib/validation'
import type { Env } from '../../../types'
import { profileService } from '../service/profile.service'

const UPDATE_SCHEMA = {
  name: { type: 'string' as const, minLength: 1 },
  phone: { type: 'string' as const },
  email: { type: 'string' as const },
  address: { type: 'string' as const },
}

const CHANGE_PASSWORD_SCHEMA = {
  oldPassword: { required: true, type: 'string' as const, minLength: 1 },
  newPassword: { required: true, type: 'string' as const, minLength: 6 },
  confirmNewPassword: { required: true, type: 'string' as const, minLength: 6 },
}

export const profileController = {
  get: async (c: Context<Env>) => {
    const username = c.get('user').sub
    const profile = await profileService.get(c.env.DB, username)

    if (!profile) {
      return response.error(c, 'Profile not found', 404, 'PROFILE_NOT_FOUND')
    }

    return response.success(c, profile)
  },

  getReseller: async (c: Context<Env>) => {
    const username = c.get('user').sub
    const reseller = await profileService.getReseller(c.env.DB, username)

    if (!reseller) {
      return response.error(c, 'Reseller profile not found', 404, 'RESELLER_NOT_FOUND')
    }

    return response.success(c, reseller)
  },

  update: async (c: Context<Env>) => {
    const username = c.get('user').sub

    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, UPDATE_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'PROFILE_VALIDATION_ERROR')
    }

    const profile = await profileService.update(c.env.DB, username, result.body)

    if (!profile) {
      return response.error(c, 'Profile not found', 404, 'PROFILE_NOT_FOUND')
    }

    return response.success(c, profile)
  },

  updateAvatar: async (c: Context<Env>) => {
    const username = c.get('user').sub

    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, { avatar: { required: true, type: 'string' as const, minLength: 1 } })
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'AVATAR_VALIDATION_ERROR')
    }

    const profile = await profileService.updateAvatar(c.env.DB, username, result.body.avatar as string)

    if (!profile) {
      return response.error(c, 'Profile not found', 404, 'PROFILE_NOT_FOUND')
    }

    return response.noContent(c, 204)
  },

  changePassword: async (c: Context<Env>) => {
    const username = c.get('user').sub

    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, CHANGE_PASSWORD_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'PROFILE_VALIDATION_ERROR')
    }

    if (result.body.newPassword !== result.body.confirmNewPassword) {
      return response.error(c, 'New password and confirmation do not match', 400, 'PROFILE_VALIDATION_ERROR')
    }

    const changed = await profileService.changePassword(
      c.env.DB,
      username,
      result.body.oldPassword as string,
      result.body.newPassword as string,
    )

    if (!changed) {
      return response.error(c, 'Old password is incorrect', 401, 'PROFILE_WRONG_PASSWORD')
    }

    return response.noContent(c, 204)
  },
}
