import { ulid } from '../../../lib/ulid'
import type { District, CreateDistrictRequest, UpdateDistrictRequest } from '../district.types'

/**
 * District service — all database operations go through D1.
 *
 * D1 is Cloudflare's SQLite-at-the-edge. We access it via `c.env.DB`,
 * which is passed through from the controller.
 *
 * Key D1 methods:
 *   db.prepare(sql).bind(...params).run()       → INSERT / UPDATE / DELETE
 *   db.prepare(sql).bind(...params).first<T>()   → SELECT single row
 *   db.prepare(sql).bind(...params).all<T>()     → SELECT multiple rows
 */
export const districtService = {
  getAll: async (db: D1Database): Promise<Pick<District, 'id' | 'name'>[]> => {
    const result = await db.prepare('SELECT id, name FROM districts ORDER BY created_at DESC').all<Pick<District, 'id' | 'name'>>()
    return result.results
  },

  getById: async (db: D1Database, id: string): Promise<Omit<District, 'created_at' | 'updated_at' | 'deleted_at'> | null> => {
    return db.prepare('SELECT id, name, code, lat, lng FROM districts WHERE id = ?').bind(id).first()
  },

  /** Internal: full row for update logic */
  _getFull: async (db: D1Database, id: string): Promise<District | null> => {
    return db.prepare('SELECT * FROM districts WHERE id = ?').bind(id).first<District>()
  },

  /** Check if any sub-districts reference this district */
  _hasSubDistricts: async (db: D1Database, id: string): Promise<boolean> => {
    const row = await db.prepare('SELECT 1 FROM sub_districts WHERE district_id = ? AND deleted_at IS NULL').bind(id).first()
    return row !== null
  },

  /** Check if a name already exists. Optionally exclude an id (for update self-exclusion). */
  _nameExists: async (db: D1Database, name: string, excludeId?: string): Promise<boolean> => {
    if (excludeId) {
      const row = await db.prepare('SELECT 1 FROM districts WHERE name = ? AND id != ?').bind(name, excludeId).first()
      return row !== null
    }
    const row = await db.prepare('SELECT 1 FROM districts WHERE name = ?').bind(name).first()
    return row !== null
  },

  create: async (db: D1Database, body: CreateDistrictRequest): Promise<void> => {
    const id = ulid()
    await db
      .prepare('INSERT INTO districts (id, name, code, lat, lng) VALUES (?, ?, ?, ?, ?)')
      .bind(id, body.name, body.code ?? null, body.lat ?? null, body.lng ?? null)
      .run()
  },

  update: async (db: D1Database, id: string, body: UpdateDistrictRequest): Promise<boolean> => {
    const existing = await districtService._getFull(db, id)
    if (!existing) return false

    const name = body.name ?? existing.name
    const code = body.code !== undefined ? body.code : existing.code
    const lat = body.lat !== undefined ? body.lat : existing.lat
    const lng = body.lng !== undefined ? body.lng : existing.lng

    await db
      .prepare('UPDATE districts SET name = ?, code = ?, lat = ?, lng = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(name, code, lat, lng, id)
      .run()

    return true
  },

  remove: async (db: D1Database, id: string): Promise<void> => {
    await db.prepare('DELETE FROM districts WHERE id = ?').bind(id).run()
  },
}
