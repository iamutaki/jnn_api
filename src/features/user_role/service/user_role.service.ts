import type { RoleForUser, UserWithRole } from '../user_role.types'

export const userRoleService = {
  getRolesForUser: async (db: D1Database, userId: string): Promise<RoleForUser[]> => {
    const result = await db.prepare(`
      SELECT r.id, r.name
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ?
      ORDER BY r.name
    `).bind(userId).all<RoleForUser>()
    return result.results
  },

  getUsersForRole: async (db: D1Database, roleId: string): Promise<UserWithRole[]> => {
    const result = await db.prepare(`
      SELECT u.id, u.name
      FROM user_roles ur
      JOIN users u ON ur.user_id = u.id
      WHERE ur.role_id = ?
      ORDER BY u.name
    `).bind(roleId).all<UserWithRole>()
    return result.results
  },

  assign: async (db: D1Database, userId: string, roleIds: string[]): Promise<number> => {
    const placeholders = roleIds.map(() => '(?, ?)').join(', ')
    const params: string[] = []
    for (const roleId of roleIds) {
      params.push(userId, roleId)
    }

    const result = await db
      .prepare(`INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ${placeholders}`)
      .bind(...params)
      .run()

    return result.meta.changes
  },

  remove: async (db: D1Database, userId: string, roleId: string): Promise<boolean> => {
    const existing = await db
      .prepare('SELECT 1 FROM user_roles WHERE user_id = ? AND role_id = ?')
      .bind(userId, roleId)
      .first()
    if (!existing) return false

    await db
      .prepare('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?')
      .bind(userId, roleId)
      .run()
    return true
  },

  userExists: async (db: D1Database, userId: string): Promise<boolean> => {
    const row = await db.prepare('SELECT 1 FROM users WHERE id = ?').bind(userId).first()
    return row !== null
  },

  roleExists: async (db: D1Database, roleId: string): Promise<boolean> => {
    const row = await db.prepare('SELECT 1 FROM roles WHERE id = ?').bind(roleId).first()
    return row !== null
  },

  roleIdsExist: async (db: D1Database, roleIds: string[]): Promise<{ allExist: boolean; missing: string[] }> => {
    const placeholders = roleIds.map(() => '?').join(', ')
    const result = await db
      .prepare(`SELECT id FROM roles WHERE id IN (${placeholders})`)
      .bind(...roleIds)
      .all<{ id: string }>()

    const found = new Set(result.results.map((r) => r.id))
    const missing = roleIds.filter((id) => !found.has(id))
    return { allExist: missing.length === 0, missing }
  },
}
