import { ulid } from '../../../lib/ulid'
import type { Role, CreateRoleRequest, UpdateRoleRequest } from '../role.types'

export const roleService = {
  getAll: async (db: D1Database): Promise<Pick<Role, 'id' | 'name'>[]> => {
    const result = await db.prepare('SELECT id, name FROM roles ORDER BY created_at DESC').all<Pick<Role, 'id' | 'name'>>()
    return result.results
  },

  getById: async (db: D1Database, id: string): Promise<Omit<Role, 'created_at' | 'updated_at' | 'deleted_at'> | null> => {
    return db.prepare('SELECT id, name, description FROM roles WHERE id = ?').bind(id).first()
  },

  _getFull: async (db: D1Database, id: string): Promise<Role | null> => {
    return db.prepare('SELECT * FROM roles WHERE id = ?').bind(id).first<Role>()
  },

  _nameExists: async (db: D1Database, name: string, excludeId?: string): Promise<boolean> => {
    if (excludeId) {
      const row = await db.prepare('SELECT 1 FROM roles WHERE name = ? AND id != ?').bind(name, excludeId).first()
      return row !== null
    }
    const row = await db.prepare('SELECT 1 FROM roles WHERE name = ?').bind(name).first()
    return row !== null
  },

  _hasUsers: async (db: D1Database, id: string): Promise<boolean> => {
    const row = await db.prepare('SELECT 1 FROM user_roles WHERE role_id = ?').bind(id).first()
    return row !== null
  },

  create: async (db: D1Database, body: CreateRoleRequest): Promise<void> => {
    const id = ulid()
    await db
      .prepare('INSERT INTO roles (id, name, description) VALUES (?, ?, ?)')
      .bind(id, body.name, body.description ?? null)
      .run()
  },

  update: async (db: D1Database, id: string, body: UpdateRoleRequest): Promise<boolean> => {
    const existing = await roleService._getFull(db, id)
    if (!existing) return false

    const name = body.name ?? existing.name
    const description = body.description !== undefined ? body.description : existing.description

    await db
      .prepare('UPDATE roles SET name = ?, description = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(name, description, id)
      .run()

    return true
  },

  remove: async (db: D1Database, id: string): Promise<void> => {
    await db.prepare('DELETE FROM roles WHERE id = ?').bind(id).run()
  },
}
