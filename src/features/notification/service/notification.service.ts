import { ulid } from '../../../lib/ulid'
import { sendFcm } from '../../../lib/fcm'
import type { Notification, NotificationListItem, NotifSummary } from '../notification.types'

interface NotifRow {
  id: string
  user_id: string
  title: string
  body: string
  type: string
  udid: string | null
  fcm_token: string | null
  image: string | null
  action_url: string | null
  payload: string | null
  is_read: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

function toListItem(row: NotifRow): NotificationListItem {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    type: row.type,
    image: row.image,
    actionUrl: row.action_url,
    payload: row.payload,
    isRead: row.is_read === 1,
    createdAt: row.created_at,
  }
}

interface SendParams {
  db: D1Database
  projectId: string
  clientEmail: string
  privateKey: string
  targetUserId: string
  title: string
  body: string
  type?: string
  image?: string
  actionUrl?: string
}

export const notificationService = {
  list: async (db: D1Database, userId: string, page = 1, limit = 20): Promise<{ items: NotificationListItem[]; summary: NotifSummary }> => {
    const offset = (page - 1) * limit

    const countRow = await db
      .prepare('SELECT COUNT(*) as total FROM notifications WHERE user_id = ? AND deleted_at IS NULL')
      .bind(userId)
      .first<{ total: number }>()

    const unreadRow = await db
      .prepare("SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND deleted_at IS NULL AND is_read = 0")
      .bind(userId)
      .first<{ unread: number }>()

    const rows = await db
      .prepare('SELECT * FROM notifications WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .bind(userId, limit, offset)
      .all<NotifRow>()

    return {
      items: rows.results.map(toListItem),
      summary: {
        total: countRow?.total ?? 0,
        unread: unreadRow?.unread ?? 0,
      },
    }
  },

  send: async (params: SendParams): Promise<{ sent: number; failed: number }> => {
    const { db, projectId, clientEmail, privateKey, targetUserId, title, body, type, image, actionUrl } = params

    const devices = await db
      .prepare('SELECT id, udid, fcm_token FROM device_tokens WHERE user_id = ? AND fcm_token IS NOT NULL AND deleted_at IS NULL')
      .bind(targetUserId)
      .all<{ id: string; udid: string; fcm_token: string }>()

    if (devices.results.length === 0) return { sent: 0, failed: 0 }

    const fcmTokens = devices.results.map(d => d.fcm_token)
    const { success, failed } = await sendFcm(projectId, clientEmail, privateKey, fcmTokens, title, body, { image, actionUrl })

    const stmts: any[] = []

    for (const device of devices.results) {
      const isSuccess = success.includes(device.fcm_token)
      stmts.push(
        db.prepare(
          'INSERT INTO notifications (id, user_id, title, body, type, udid, fcm_token, image, action_url, is_read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ).bind(
          ulid(), targetUserId, title, body, type ?? 'general',
          device.udid, device.fcm_token, image ?? null, actionUrl ?? null,
          isSuccess ? 0 : 1,
        ),
      )
    }

    await db.batch(stmts)
    return { sent: success.length, failed: failed.length }
  },

  markRead: async (db: D1Database, userId: string, id: string): Promise<boolean> => {
    const row = await db
      .prepare('SELECT id FROM notifications WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
      .bind(id, userId)
      .first<{ id: string }>()

    if (!row) return false

    await db
      .prepare("UPDATE notifications SET is_read = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?")
      .bind(id)
      .run()

    return true
  },
}
