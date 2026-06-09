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

  markRead: async (db: D1Database, userId: string, id: string): Promise<boolean> => {
    const row = await db
      .prepare('SELECT id FROM notifications WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
      .bind(id, userId)
      .first<{ id: string }>()

    if (!row) return false

    await db
      .prepare("UPDATE notifications SET is_read = 1, updated_at = datetime('now') WHERE id = ?")
      .bind(id)
      .run()

    return true
  },
}
