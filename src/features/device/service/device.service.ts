import { ulid } from '../../../lib/ulid'
import type { DeviceToken } from '../device.types'

interface DeviceRow {
  id: string
  user_id: string
  udid: string
  fcm_token: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

function toDevice(row: DeviceRow): DeviceToken {
  return {
    id: row.id,
    userId: row.user_id,
    udid: row.udid,
    fcmToken: row.fcm_token,
  }
}

export const deviceService = {
  register: async (db: D1Database, userId: string, udid: string, fcmToken: string): Promise<DeviceToken> => {
    const existing = await db
      .prepare('SELECT * FROM device_tokens WHERE udid = ?')
      .bind(udid)
      .first<DeviceRow>()

    if (existing) {
      await db
        .prepare("UPDATE device_tokens SET fcm_token = ?, user_id = ?, updated_at = datetime('now'), deleted_at = NULL WHERE udid = ?")
        .bind(fcmToken, userId, udid)
        .run()

      const updated = await db
        .prepare('SELECT * FROM device_tokens WHERE udid = ?')
        .bind(udid)
        .first<DeviceRow>()

      return toDevice(updated!)
    }

    const id = ulid()
    await db
      .prepare('INSERT INTO device_tokens (id, user_id, udid, fcm_token) VALUES (?, ?, ?, ?)')
      .bind(id, userId, udid, fcmToken)
      .run()

    const row = await db
      .prepare('SELECT * FROM device_tokens WHERE id = ?')
      .bind(id)
      .first<DeviceRow>()

    return toDevice(row!)
  },

  revoke: async (db: D1Database, userId: string, udid: string): Promise<boolean> => {
    const existing = await db
      .prepare('SELECT * FROM device_tokens WHERE udid = ? AND user_id = ? AND deleted_at IS NULL')
      .bind(udid, userId)
      .first<DeviceRow>()

    if (!existing) return false

    await db
      .prepare("UPDATE device_tokens SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE udid = ?")
      .bind(udid)
      .run()

    return true
  },
}
