import type { Context } from 'hono'
import { response } from '../../../lib/response'
import type { Env } from '../../../types'
import { notificationService } from '../service/notification.service'

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
