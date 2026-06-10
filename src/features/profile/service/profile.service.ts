import type { User } from '../../user/user.types'
import type { ProfileResponse } from '../profile.types'
import { hashPassword, verifyPassword } from '../../../lib/password'

function toProfile(user: User): ProfileResponse {
  const { password, deleted_at, created_at, updated_at, ...rest } = user
  return rest
}

export const profileService = {
  get: async (db: D1Database, username: string): Promise<ProfileResponse | null> => {
    const user = await db
      .prepare('SELECT * FROM users WHERE username = ?')
      .bind(username)
      .first<User>()
    if (!user) return null
    return toProfile(user)
  },

  update: async (db: D1Database, username: string, body: Record<string, unknown>): Promise<ProfileResponse | null> => {
    const existing = await db
      .prepare('SELECT * FROM users WHERE username = ?')
      .bind(username)
      .first<User>()
    if (!existing) return null

    const name = body.name ?? existing.name
    const phone = body.phone !== undefined ? body.phone : existing.phone
    const email = body.email !== undefined ? body.email : existing.email
    const address = body.address !== undefined ? body.address : existing.address

    await db
      .prepare("UPDATE users SET name = ?, phone = ?, email = ?, address = ?, updated_at = datetime('now') WHERE username = ?")
      .bind(name, phone, email, address, username)
      .run()

    const updated = await db
      .prepare('SELECT * FROM users WHERE username = ?')
      .bind(username)
      .first<User>()
    return updated ? toProfile(updated) : null
  },

  updateAvatar: async (db: D1Database, username: string, avatar: string): Promise<ProfileResponse | null> => {
    const existing = await db
      .prepare('SELECT * FROM users WHERE username = ?')
      .bind(username)
      .first<User>()
    if (!existing) return null

    await db
      .prepare("UPDATE users SET avatar = ?, updated_at = datetime('now') WHERE username = ?")
      .bind(avatar, username)
      .run()

    const updated = await db
      .prepare('SELECT * FROM users WHERE username = ?')
      .bind(username)
      .first<User>()
    return updated ? toProfile(updated) : null
  },

  changePassword: async (db: D1Database, username: string, oldPassword: string, newPassword: string): Promise<boolean> => {
    const user = await db
      .prepare('SELECT * FROM users WHERE username = ?')
      .bind(username)
      .first<User>()
    if (!user) return false

    const valid = await verifyPassword(oldPassword, user.password)
    if (!valid) return false

    const hashed = await hashPassword(newPassword)
    await db
      .prepare("UPDATE users SET password = ?, updated_at = datetime('now') WHERE username = ?")
      .bind(hashed, username)
      .run()

    return true
  },
}
