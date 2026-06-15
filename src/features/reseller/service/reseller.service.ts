import { ulid } from '../../../lib/ulid'
import { hashPassword } from '../../../lib/password'
import type { Reseller, ResellerListItem, CreateResellerRequest, UpdateResellerRequest, ResellerResponse } from '../reseller.types'

export const resellerService = {
  getAll: async (db: D1Database): Promise<ResellerListItem[]> => {
    const result = await db.prepare(`
      SELECT
        u.id, u.name, u.username, u.avatar,
        sd.id AS sd_id, sd.name AS sd_name
      FROM resellers r
      JOIN users u ON u.id = r.id
      LEFT JOIN sub_districts sd ON sd.id = r.sub_district_id
      WHERE r.deleted_at IS NULL
      ORDER BY r.created_at DESC
    `).all()

    return (result.results as any[]).map((row: any) => ({
      id: row.id,
      user: { id: row.id, name: row.name, username: row.username, avatar: row.avatar },
      subDistrict: { id: row.sd_id ?? '', name: row.sd_name ?? '' },
    }))
  },

  getById: async (db: D1Database, id: string): Promise<ResellerResponse | null> => {
    const row: any = await db.prepare(`
      SELECT
        u.id, u.name, u.username, u.avatar,
        r.venue_photo, r.commission_rate, r.commission_amount,
        r.lat, r.lng, r.phone,
        sd.id AS sd_id, sd.name AS sd_name,
        d.id AS d_id, d.name AS d_name
      FROM resellers r
      JOIN users u ON u.id = r.id
      LEFT JOIN sub_districts sd ON sd.id = r.sub_district_id
      LEFT JOIN districts d ON d.id = sd.district_id
      WHERE r.id = ? AND r.deleted_at IS NULL
    `).bind(id).first()

    if (!row) return null

    return {
      user: { id: row.id, name: row.name, username: row.username, avatar: row.avatar },
      venuePhoto: row.venue_photo,
      subDistrict: {
        id: row.sd_id,
        name: row.sd_name,
        district: { id: row.d_id, name: row.d_name },
      },
      commissionRate: row.commission_rate,
      commissionAmount: row.commission_amount,
      lat: row.lat,
      lng: row.lng,
      phone: row.phone,
    }
  },

  _getFull: async (db: D1Database, id: string): Promise<Reseller | null> => {
    return db.prepare('SELECT * FROM resellers WHERE id = ?').bind(id).first<Reseller>()
  },

  _fieldExists: async (db: D1Database, field: 'username' | 'phone', value: string, excludeId?: string): Promise<boolean> => {
    if (excludeId) {
      const row = await db.prepare(`SELECT 1 FROM users WHERE ${field} = ? AND id != ?`).bind(value, excludeId).first()
      return row !== null
    }
    const row = await db.prepare(`SELECT 1 FROM users WHERE ${field} = ?`).bind(value).first()
    return row !== null
  },

  _subDistrictExists: async (db: D1Database, id: string): Promise<boolean> => {
    const row = await db.prepare('SELECT 1 FROM sub_districts WHERE id = ?').bind(id).first()
    return row !== null
  },

  create: async (db: D1Database, body: CreateResellerRequest): Promise<void> => {
    const id = ulid()
    const hashed = await hashPassword(body.password)

    await db.batch([
      db.prepare('INSERT INTO users (id, username, password, name, phone, avatar) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(id, body.username, hashed, body.name, body.phone ?? null, body.avatar ?? null),
      db.prepare('INSERT INTO resellers (id, venue_photo, sub_district_id, commission_rate, commission_amount, lat, lng, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, body.venuePhoto ?? null, body.subDistrictId, body.commissionRate ?? 0, body.commissionAmount ?? 0, body.lat ?? null, body.lng ?? null, body.phone ?? null),
      db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)')
        .bind(id, '01KTRS8AD1G6JJBTH8EP81R4C0'),
    ])
  },

  update: async (db: D1Database, id: string, body: UpdateResellerRequest): Promise<boolean> => {
    const existing = await resellerService._getFull(db, id)
    if (!existing) return false

    const stmts: any[] = []

    const userFields: string[] = []
    const userVals: any[] = []
    if (body.name !== undefined) { userFields.push('name = ?'); userVals.push(body.name) }
    if (body.username !== undefined) { userFields.push('username = ?'); userVals.push(body.username) }
    if (body.password !== undefined && body.password !== null) { userFields.push('password = ?'); userVals.push(await hashPassword(body.password)) }
    if (body.avatar !== undefined) { userFields.push('avatar = ?'); userVals.push(body.avatar) }
    if (body.phone !== undefined) { userFields.push('phone = ?'); userVals.push(body.phone) }
    if (userFields.length > 0) {
      userFields.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")
      userVals.push(id)
      stmts.push(db.prepare(`UPDATE users SET ${userFields.join(', ')} WHERE id = ?`).bind(...userVals))
    }

    const venuePhoto = body.venuePhoto !== undefined ? body.venuePhoto : existing.venue_photo
    const subDistrictId = body.subDistrictId ?? existing.sub_district_id
    const commissionRate = body.commissionRate !== undefined ? body.commissionRate : existing.commission_rate
    const commissionAmount = body.commissionAmount !== undefined ? body.commissionAmount : existing.commission_amount
    const lat = body.lat !== undefined ? body.lat : existing.lat
    const lng = body.lng !== undefined ? body.lng : existing.lng
    const phone = body.phone !== undefined ? body.phone : existing.phone

    stmts.push(
      db.prepare("UPDATE resellers SET venue_photo = ?, sub_district_id = ?, commission_rate = ?, commission_amount = ?, lat = ?, lng = ?, phone = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?")
        .bind(venuePhoto, subDistrictId, commissionRate, commissionAmount, lat, lng, phone, id),
    )

    await db.batch(stmts)
    return true
  },

  remove: async (db: D1Database, id: string): Promise<boolean> => {
    const existing = await resellerService._getFull(db, id)
    if (!existing) return false

    await db.batch([
      db.prepare("UPDATE resellers SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?").bind(id),
      db.prepare("UPDATE users SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?").bind(id),
    ])
    return true
  },
}
