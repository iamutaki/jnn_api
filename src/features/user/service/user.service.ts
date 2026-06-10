import { ulid } from '../../../lib/ulid'
import { hashPassword } from '../../../lib/password'
import type { User, SafeUser, SafeUserListItem, CreateUserRequest, UpdateUserRequest } from '../user.types'

export const userService = {
  getAll: async (db: D1Database): Promise<SafeUserListItem[]> => {
    const result = await db.prepare(`
      SELECT u.id, u.username, u.name, u.avatar, GROUP_CONCAT(r.name, ',') as role_names
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `).all<any>()

    return result.results.map((row: any) => ({
      id: row.id,
      username: row.username,
      name: row.name,
      avatar: row.avatar,
      roles: row.role_names ? row.role_names.split(',').filter(Boolean) : [],
    }))
  },

  getById: async (db: D1Database, id: string): Promise<SafeUser | null> => {
    const row: any = await db
      .prepare(`
        SELECT u.*, GROUP_CONCAT(r.name, ',') as role_names
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.id = ?
        GROUP BY u.id
      `)
      .bind(id)
      .first()
    if (!row) return null

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

  create: async (db: D1Database, body: CreateUserRequest, roleIds: string[]): Promise<void> => {
    const id = ulid()
    const hashed = await hashPassword(body.password)

    const stmts: any[] = [
      db.prepare('INSERT INTO users (id, username, password, name, phone, email, address, avatar) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, body.username, hashed, body.name, body.phone ?? null, body.email ?? null, body.address ?? null, body.avatar ?? null),
    ]

    for (const roleId of roleIds) {
      stmts.push(db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(id, roleId))
    }

    await db.batch(stmts)
  },

  update: async (db: D1Database, id: string, body: UpdateUserRequest, roleIds?: string[]): Promise<boolean> => {
    const existing = await userService._getFull(db, id)
    if (!existing) return false

    const username = body.username !== undefined ? body.username : existing.username
    const password = body.password !== undefined && body.password !== null ? await hashPassword(body.password) : existing.password
    const name = body.name ?? existing.name
    const phone = body.phone !== undefined ? body.phone : existing.phone
    const email = body.email !== undefined ? body.email : existing.email
    const address = body.address !== undefined ? body.address : existing.address
    const avatar = body.avatar !== undefined ? body.avatar : existing.avatar

    const stmts: any[] = [
      db.prepare('UPDATE users SET username = ?, password = ?, name = ?, phone = ?, email = ?, address = ?, avatar = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .bind(username, password, name, phone, email, address, avatar, id),
    ]

    if (roleIds !== undefined) {
      stmts.push(db.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(id))
      for (const roleId of roleIds) {
        stmts.push(db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(id, roleId))
      }
    }

    await db.batch(stmts)

    return true
  },

  remove: async (db: D1Database, id: string): Promise<boolean> => {
    const existing = await userService._getFull(db, id)
    if (!existing) return false

    await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
    return true
  },
}
