import { ulid } from '../../../lib/ulid'
import type { Voucher, CreateVoucherRequest, UpdateVoucherRequest } from '../voucher.types'

export const voucherService = {
  getAll: async (db: D1Database): Promise<Pick<Voucher, 'id' | 'name' | 'price'>[]> => {
    const result = await db.prepare('SELECT id, name, price FROM vouchers WHERE deleted_at IS NULL ORDER BY created_at DESC').all<Pick<Voucher, 'id' | 'name' | 'price'>>()
    return result.results
  },

  getById: async (db: D1Database, id: string): Promise<Omit<Voucher, 'created_at' | 'updated_at' | 'deleted_at'> | null> => {
    return db.prepare('SELECT id, name, price, description FROM vouchers WHERE id = ? AND deleted_at IS NULL').bind(id).first()
  },

  _getFull: async (db: D1Database, id: string): Promise<Voucher | null> => {
    return db.prepare('SELECT * FROM vouchers WHERE id = ? AND deleted_at IS NULL').bind(id).first<Voucher>()
  },

  _nameExists: async (db: D1Database, name: string, excludeId?: string): Promise<boolean> => {
    if (excludeId) {
      const row = await db.prepare('SELECT 1 FROM vouchers WHERE name = ? AND id != ? AND deleted_at IS NULL').bind(name, excludeId).first()
      return row !== null
    }
    const row = await db.prepare('SELECT 1 FROM vouchers WHERE name = ? AND deleted_at IS NULL').bind(name).first()
    return row !== null
  },

  _linkedToSubDistricts: async (db: D1Database, id: string): Promise<boolean> => {
    const row = await db.prepare('SELECT 1 FROM sub_district_vouchers WHERE voucher_id = ? AND deleted_at IS NULL').bind(id).first()
    return row !== null
  },

  create: async (db: D1Database, body: CreateVoucherRequest): Promise<void> => {
    const id = ulid()
    await db
      .prepare('INSERT INTO vouchers (id, name, price, description) VALUES (?, ?, ?, ?)')
      .bind(id, body.name, body.price, body.description ?? null)
      .run()
  },

  update: async (db: D1Database, id: string, body: UpdateVoucherRequest): Promise<boolean> => {
    const existing = await voucherService._getFull(db, id)
    if (!existing) return false

    const name = body.name ?? existing.name
    const price = body.price !== undefined ? body.price : existing.price
    const description = body.description !== undefined ? body.description : existing.description

    await db
      .prepare("UPDATE vouchers SET name = ?, price = ?, description = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(name, price, description, id)
      .run()

    return true
  },

  remove: async (db: D1Database, id: string): Promise<void> => {
    await db.prepare("UPDATE vouchers SET deleted_at = datetime('now') WHERE id = ?").bind(id).run()
  },
}
