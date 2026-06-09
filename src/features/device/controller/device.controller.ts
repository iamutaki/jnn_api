import type { Context } from 'hono'
import { response } from '../../../lib/response'
import { safeJsonBody } from '../../../lib/request'
import { validate } from '../../../lib/validation'
import type { Env } from '../../../types'
import { deviceService } from '../service/device.service'

const REGISTER_SCHEMA = {
  udid: { required: true, type: 'string' as const, minLength: 1 },
  fcmToken: { required: true, type: 'string' as const, minLength: 1 },
}

const REVOKE_SCHEMA = {
  udid: { required: true, type: 'string' as const, minLength: 1 },
}

export const deviceController = {
  register: async (c: Context<Env>) => {
    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, REGISTER_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'DEVICE_VALIDATION_ERROR')
    }

    const userId = c.get('user').userId
    const { udid, fcmToken } = result.body as { udid: string; fcmToken: string }

    const device = await deviceService.register(c.env.DB, userId, udid, fcmToken)
    return response.success(c, device, 201)
  },

  revoke: async (c: Context<Env>) => {
    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, REVOKE_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'DEVICE_VALIDATION_ERROR')
    }

    const userId = c.get('user').userId
    const { udid } = result.body as { udid: string }

    const revoked = await deviceService.revoke(c.env.DB, userId, udid)

    if (!revoked) {
      return response.error(c, 'Device not found', 404, 'DEVICE_NOT_FOUND')
    }

    return response.noContent(c, 204)
  },
}
