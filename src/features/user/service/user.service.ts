import { ulid } from '../../../lib/ulid'
import { hashPassword } from '../../../lib/password'
import type { User, SafeUser, SafeUserListItem, CreateUserRequest, UpdateUserRequest } from '../user.types'

function toSafeUser(user: User): SafeUser {
  const { password, deleted_at, created_at, updated_at, ...rest } = user
  return rest
}

export const userService = {
  getAll: async (db: D1Database): Promise<SafeUserListItem[]> => {
    const result = await db.prepare(`
      SELECT id, username, name FROM users ORDER BY created_at DESC
    `).all<SafeUserListItem>()
    return result.results
  },

  getById: async (db: D1Database, id: string): Promise<SafeUser | null> => {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<User>()
    if (!user) return null
    return toSafeUser(user)
  },

  _getFull: async (db: D1Database, id: string): Promise<User | null> => {
    return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<User>()
  },

  _fieldExists: async (
    db: D1Database,
    field: 'username' | 'email' | 'phone',
    value: string,
    excludeId?: string,
  ): Promise<boolean> => {
    if (excludeId) {
      const row = await db.prepare(`SELECT 1 FROM users WHERE ${field} = ? AND id != ?`).bind(value, excludeId).first()
      return row !== null
    }
    const row = await db.prepare(`SELECT 1 FROM users WHERE ${field} = ?`).bind(value).first()
    return row !== null
  },

  create: async (db: D1Database, body: CreateUserRequest): Promise<void> => {
    const id = ulid()
    const hashed = await hashPassword(body.password)
    await db
      .prepare('INSERT INTO users (id, username, password, name, phone, email, address, avatar) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, body.username, hashed, body.name, body.phone ?? null, body.email ?? null, body.address ?? null, body.avatar ?? null)
      .run()
  },

  update: async (db: D1Database, id: string, body: UpdateUserRequest): Promise<boolean> => {
    const existing = await userService._getFull(db, id)
    if (!existing) return false

    const username = body.username !== undefined ? body.username : existing.username
    const password = body.password !== undefined ? await hashPassword(body.password) : existing.password
    const name = body.name ?? existing.name
    const phone = body.phone !== undefined ? body.phone : existing.phone
    const email = body.email !== undefined ? body.email : existing.email
    const address = body.address !== undefined ? body.address : existing.address
    const avatar = body.avatar !== undefined ? body.avatar : existing.avatar

    await db
      .prepare('UPDATE users SET username = ?, password = ?, name = ?, phone = ?, email = ?, address = ?, avatar = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(username, password, name, phone, email, address, avatar, id)
      .run()

    return true
  },

  remove: async (db: D1Database, id: string): Promise<boolean> => {
    const existing = await userService._getFull(db, id)
    if (!existing) return false

    await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
    return true
  },
}
