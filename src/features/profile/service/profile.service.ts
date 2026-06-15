import type { ProfileResponse, ProfileResellerResponse } from '../profile.types'
import { hashPassword, verifyPassword } from '../../../lib/password'

function rowToProfile(row: any): ProfileResponse {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    avatar: row.avatar,
    roles: row.role_names ? row.role_names.split(',').filter(Boolean) : [],
  }
}

const PROFILE_QUERY = `
  SELECT u.*, GROUP_CONCAT(r.name, ',') as role_names
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles r ON r.id = ur.role_id
  WHERE u.username = ?
  GROUP BY u.id
`

export const profileService = {
  get: async (db: D1Database, username: string): Promise<ProfileResponse | null> => {
    const row: any = await db.prepare(PROFILE_QUERY).bind(username).first()
    if (!row) return null
    return rowToProfile(row)
  },

  getReseller: async (db: D1Database, username: string): Promise<ProfileResellerResponse | null> => {
    const row: any = await db
      .prepare(`
        SELECT r.sub_district_id, r.lat, r.lng
        FROM resellers r
        JOIN users u ON u.id = r.id
        WHERE u.username = ? AND r.deleted_at IS NULL
      `)
      .bind(username)
      .first()
    if (!row) return null
    return {
      subDistrictId: row.sub_district_id,
      lat: row.lat,
      lon: row.lng,
    }
  },

  update: async (db: D1Database, username: string, body: Record<string, unknown>): Promise<ProfileResponse | null> => {
    const existing = await db.prepare(PROFILE_QUERY).bind(username).first<any>()
    if (!existing) return null

    const name = body.name ?? existing.name
    const phone = body.phone !== undefined ? body.phone : existing.phone
    const email = body.email !== undefined ? body.email : existing.email
    const address = body.address !== undefined ? body.address : existing.address

    await db
      .prepare("UPDATE users SET name = ?, phone = ?, email = ?, address = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE username = ?")
      .bind(name, phone, email, address, username)
      .run()

    const updated: any = await db.prepare(PROFILE_QUERY).bind(username).first()
    return updated ? rowToProfile(updated) : null
  },

  updateAvatar: async (db: D1Database, username: string, avatar: string): Promise<ProfileResponse | null> => {
    const existing = await db.prepare(PROFILE_QUERY).bind(username).first<any>()
    if (!existing) return null

    await db
      .prepare("UPDATE users SET avatar = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE username = ?")
      .bind(avatar, username)
      .run()

    const updated: any = await db.prepare(PROFILE_QUERY).bind(username).first()
    return updated ? rowToProfile(updated) : null
  },

  changePassword: async (db: D1Database, username: string, oldPassword: string, newPassword: string): Promise<boolean> => {
    const user: any = await db
      .prepare('SELECT * FROM users WHERE username = ?')
      .bind(username)
      .first()
    if (!user) return false

    const valid = await verifyPassword(oldPassword, user.password)
    if (!valid) return false

    const hashed = await hashPassword(newPassword)
    await db
      .prepare("UPDATE users SET password = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE username = ?")
      .bind(hashed, username)
      .run()

    return true
  },
}
