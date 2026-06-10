import { ulid } from '../../../lib/ulid'
import type { SubDistrictVoucher, SubDistrictVoucherResponse, SyncSubDistrictVoucherRequest } from '../sub_district_voucher.types'

export const subDistrictVoucherService = {
  getAll: async (db: D1Database, subDistrictId: string): Promise<SubDistrictVoucherResponse[]> => {
    const result = await db.prepare(`
      SELECT
        sv.id,
        sv.voucher_id,
        v.name AS voucher_name,
        v.price AS voucher_price
      FROM sub_district_vouchers sv
      LEFT JOIN vouchers v ON sv.voucher_id = v.id
      WHERE sv.sub_district_id = ? AND sv.deleted_at IS NULL
      ORDER BY sv.created_at DESC
    `).bind(subDistrictId).all()

    return (result.results as any[]).map((row: any) => ({
      id: row.voucher_id,
      name: row.voucher_name,
      price: row.voucher_price,
    }))
  },

  _getFull: async (db: D1Database, id: string): Promise<SubDistrictVoucher | null> => {
    return db.prepare('SELECT * FROM sub_district_vouchers WHERE id = ?').bind(id).first<SubDistrictVoucher>()
  },

  _subDistrictExists: async (db: D1Database, id: string): Promise<boolean> => {
    const row = await db.prepare('SELECT 1 FROM sub_districts WHERE id = ?').bind(id).first()
    return row !== null
  },

  _voucherExists: async (db: D1Database, id: string): Promise<boolean> => {
    const row = await db.prepare('SELECT 1 FROM vouchers WHERE id = ? AND deleted_at IS NULL').bind(id).first()
    return row !== null
  },

  sync: async (db: D1Database, subDistrictId: string, body: SyncSubDistrictVoucherRequest): Promise<void> => {
    const statements = [
      db.prepare('DELETE FROM sub_district_vouchers WHERE sub_district_id = ?').bind(subDistrictId),
      ...body.voucherIds.map(vId =>
        db.prepare('INSERT INTO sub_district_vouchers (id, sub_district_id, voucher_id) VALUES (?, ?, ?)').bind(ulid(), subDistrictId, vId),
      ),
    ]
    await db.batch(statements)
  },
}
