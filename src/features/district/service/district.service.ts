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
  getAll: async (db: D1Database): Promise<District[]> => {
    const result = await db.prepare('SELECT * FROM districts ORDER BY created_at DESC').all<District>()
    return result.results
  },

  getById: async (db: D1Database, id: string): Promise<District | null> => {
    return db.prepare('SELECT * FROM districts WHERE id = ?').bind(id).first<District>()
  },

  create: async (db: D1Database, body: CreateDistrictRequest): Promise<District> => {
    const id = ulid()
    await db
      .prepare('INSERT INTO districts (id, name, code, lat, lng) VALUES (?, ?, ?, ?, ?)')
      .bind(id, body.name, body.code ?? null, body.lat ?? null, body.lng ?? null)
      .run()

    const created = await districtService.getById(db, id)
    return created!
  },

  update: async (db: D1Database, id: string, body: UpdateDistrictRequest): Promise<District | null> => {
    const existing = await districtService.getById(db, id)
    if (!existing) return null

    const name = body.name ?? existing.name
    const code = body.code !== undefined ? body.code : existing.code
    const lat = body.lat !== undefined ? body.lat : existing.lat
    const lng = body.lng !== undefined ? body.lng : existing.lng

    await db
      .prepare('UPDATE districts SET name = ?, code = ?, lat = ?, lng = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(name, code, lat, lng, id)
      .run()

    return districtService.getById(db, id)
  },

  remove: async (db: D1Database, id: string): Promise<boolean> => {
    const existing = await districtService.getById(db, id)
    if (!existing) return false

    await db.prepare('DELETE FROM districts WHERE id = ?').bind(id).run()
    return true
  },
}
