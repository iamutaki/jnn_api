import type { Context } from 'hono'
import { response } from '../../../lib/response'
import { safeJsonBody } from '../../../lib/request'
import { validate } from '../../../lib/validation'
import type { Env } from '../../../types'
import { notificationService } from '../service/notification.service'

const SEND_SCHEMA = {
  userId: { required: true, type: 'string' as const, minLength: 1 },
  title: { required: true, type: 'string' as const, minLength: 1 },
  body: { required: true, type: 'string' as const, minLength: 1 },
  type: { type: 'string' as const },
  image: { type: 'string' as const },
  actionUrl: { type: 'string' as const },
}

export const notificationController = {
  list: async (c: Context<Env>) => {
    const userId = c.get('user').userId
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') ?? '20', 10)))

    const { items, summary } = await notificationService.list(c.env.DB, userId, page, limit)

    return c.json({
      success: true as const,
      data: items,
      meta: {
        page,
        limit,
        total: summary.total,
        totalPages: Math.ceil(summary.total / limit),
        unread: summary.unread,
      },
    })
  },

  send: async (c: Context<Env>) => {
    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const result = validate(body, SEND_SCHEMA)
    if (!result.valid) {
      return response.error(c, result.errors.join(', '), 400, 'NOTIF_VALIDATION_ERROR')
    }

    const targetUserId = result.body.userId as string
    const title = result.body.title as string
    const text = result.body.body as string
    const type = result.body.type as string | undefined
    const image = result.body.image as string | undefined
    const actionUrl = result.body.actionUrl as string | undefined

    const { sent, failed } = await notificationService.send({
      db: c.env.DB,
      projectId: c.env.FIREBASE_PROJECT_ID,
      clientEmail: c.env.FIREBASE_CLIENT_EMAIL,
      privateKey: c.env.FIREBASE_PRIVATE_KEY,
      targetUserId,
      title,
      body: text,
      type,
      image,
      actionUrl,
    })

    return response.success(c, { sent, failed })
  },

  markRead: async (c: Context<Env>) => {
    const userId = c.get('user').userId
    const id = c.req.param('id') ?? ''

    const done = await notificationService.markRead(c.env.DB, userId, id)

    if (!done) {
      return response.error(c, 'Notification not found', 404, 'NOTIF_NOT_FOUND')
    }

    return response.noContent(c, 204)
  },
}
