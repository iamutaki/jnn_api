import { ulid } from '../../../lib/ulid'
import type { SubDistrict, CreateSubDistrictRequest, UpdateSubDistrictRequest } from '../sub_district.types'

export const subDistrictService = {
  getAll: async (db: D1Database) => {
    const result = await db.prepare(`
      SELECT
        s.id, s.name,
        d.id AS district_id, d.name AS district_name
      FROM sub_districts s
      LEFT JOIN districts d ON s.district_id = d.id
      ORDER BY s.created_at DESC
    `).all()
    return result.results.map((row: any) => ({
      id: row.id,
      name: row.name,
      district: row.district_id ? { id: row.district_id, name: row.district_name } : null,
    }))
  },

  getById: async (db: D1Database, id: string) => {
    const row: any = await db.prepare(`
      SELECT
        s.id, s.district_id, s.name, s.code, s.lat, s.lng,
        d.name AS district_name
      FROM sub_districts s
      LEFT JOIN districts d ON s.district_id = d.id
      WHERE s.id = ?
    `).bind(id).first()

    if (!row) return null

    return {
      id: row.id,
      name: row.name,
      code: row.code,
      lat: row.lat,
      lng: row.lng,
      district: row.district_id ? { id: row.district_id, name: row.district_name } : null,
    }
  },

  /** Internal: full row for update logic */
  _getFull: async (db: D1Database, id: string): Promise<SubDistrict | null> => {
    return db.prepare('SELECT * FROM sub_districts WHERE id = ?').bind(id).first<SubDistrict>()
  },

  /** Check if a district exists */
  _districtExists: async (db: D1Database, districtId: string): Promise<boolean> => {
    const row = await db.prepare('SELECT 1 FROM districts WHERE id = ?').bind(districtId).first()
    return row !== null
  },

  create: async (db: D1Database, body: CreateSubDistrictRequest): Promise<void> => {
    const id = ulid()
    await db
      .prepare('INSERT INTO sub_districts (id, district_id, name, code, lat, lng) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, body.district_id, body.name, body.code ?? null, body.lat ?? null, body.lng ?? null)
      .run()
  },

  update: async (db: D1Database, id: string, body: UpdateSubDistrictRequest): Promise<boolean> => {
    const existing = await subDistrictService._getFull(db, id)
    if (!existing) return false

    const districtId = body.district_id ?? existing.district_id
    const name = body.name ?? existing.name
    const code = body.code !== undefined ? body.code : existing.code
    const lat = body.lat !== undefined ? body.lat : existing.lat
    const lng = body.lng !== undefined ? body.lng : existing.lng

    await db
      .prepare('UPDATE sub_districts SET district_id = ?, name = ?, code = ?, lat = ?, lng = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(districtId, name, code, lat, lng, id)
      .run()

    return true
  },

  remove: async (db: D1Database, id: string): Promise<boolean> => {
    const existing = await subDistrictService._getFull(db, id)
    if (!existing) return false

    await db.prepare('DELETE FROM sub_districts WHERE id = ?').bind(id).run()
    return true
  },
}
