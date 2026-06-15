import { ulid } from '../../../lib/ulid'
import { encryptCode, decryptCode, hashCode } from '../../../lib/voucher-crypto'
import type { Env } from '../../../types'
import type {
  DigitalVoucher,
  DigitalVoucherListItem,
  DigitalVoucherDetail,
  CreateDigitalVoucherRequest,
} from '../digital_voucher.types'

const ISO = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')"

interface PreparedItem {
  id: string
  voucherId: string
  subDistrictId: string | null
  hash: string
  enc: { encryptedCode: string; iv: string; tag: string; keyVersion: number }
}

export const digitalVoucherService = {
  getAll: async (db: D1Database): Promise<DigitalVoucherListItem[]> => {
    const result = await db
      .prepare(
        `SELECT id, voucher_id, sub_district_id, status, sold_to_reseller_id, sold_sale_id, sold_at
           FROM digital_vouchers
          WHERE deleted_at IS NULL
          ORDER BY created_at DESC`,
      )
      .all<any>()
    return result.results.map((r: any) => ({
      id: r.id,
      voucherId: r.voucher_id,
      subDistrictId: r.sub_district_id,
      status: r.status,
      soldToResellerId: r.sold_to_reseller_id,
      soldSaleId: r.sold_sale_id,
      soldAt: r.sold_at,
    }))
  },

  getById: async (
    db: D1Database,
    env: Env['Bindings'],
    id: string,
    currentUserId: string,
  ): Promise<DigitalVoucherDetail | null> => {
    const row = await db
      .prepare('SELECT * FROM digital_vouchers WHERE id = ? AND deleted_at IS NULL')
      .bind(id)
      .first<DigitalVoucher>()
    if (!row) return null

    // Access control: a SOLD code is viewable only by its seller (sold_by_user_id). Anyone
    // else hitting it → throw DV_FORBIDDEN (mapped to 403 in the controller). Available
    // codes are viewable by any authenticated user (masked); the seller sees plaintext.
    if (row.sold_at !== null && row.sold_by_user_id !== currentUserId) {
      throw Object.assign(new Error('You are not allowed to view this sold voucher code'), { code: 'DV_FORBIDDEN' })
    }

    const base = {
      id: row.id,
      voucherId: row.voucher_id,
      subDistrictId: row.sub_district_id,
      status: row.status,
      soldToResellerId: row.sold_to_reseller_id,
      soldSaleId: row.sold_sale_id,
      soldAt: row.sold_at,
    }

    // available (no seller yet) → mask; sold + this caller is the seller → plaintext.
    const code = row.sold_at === null
      ? '******'
      : await decryptCode(row.encrypted_code, row.encryption_iv, row.encryption_tag, row.encryption_key_version, env)

    return { ...base, code }
  },

  // Lookup by plaintext code (e.g. redemption flow). Scoped to available+not-deleted,
  // which the unique index guarantees is at most one row.
  getByCode: async (db: D1Database, env: Env['Bindings'], code: string): Promise<DigitalVoucherDetail | null> => {
    const hash = await hashCode(code, env)
    const row = await db
      .prepare(`SELECT * FROM digital_vouchers WHERE code_hash = ? AND status = 'available' AND deleted_at IS NULL`)
      .bind(hash)
      .first<DigitalVoucher>()
    if (!row) return null

    const plaintext = await decryptCode(
      row.encrypted_code,
      row.encryption_iv,
      row.encryption_tag,
      row.encryption_key_version,
      env,
    )
    return {
      id: row.id,
      voucherId: row.voucher_id,
      subDistrictId: row.sub_district_id,
      status: row.status,
      soldToResellerId: row.sold_to_reseller_id,
      soldSaleId: row.sold_sale_id,
      soldAt: row.sold_at,
      code: plaintext,
    }
  },

  _voucherExists: async (db: D1Database, id: string): Promise<boolean> => {
    const row = await db.prepare('SELECT 1 FROM vouchers WHERE id = ? AND deleted_at IS NULL').bind(id).first()
    return row !== null
  },

  _subDistrictExists: async (db: D1Database, id: string): Promise<boolean> => {
    const row = await db.prepare('SELECT 1 FROM sub_districts WHERE id = ?').bind(id).first()
    return row !== null
  },

  // Returns the subset of hashes that already have an AVAILABLE, non-deleted row.
  // Same scope as the unique index → these block insertion.
  _conflictingHashes: async (db: D1Database, hashes: string[]): Promise<Set<string>> => {
    if (hashes.length === 0) return new Set()
    const placeholders = hashes.map(() => '?').join(',')
    const rows = await db
      .prepare(
        `SELECT DISTINCT code_hash FROM digital_vouchers
          WHERE code_hash IN (${placeholders}) AND status = 'available' AND deleted_at IS NULL`,
      )
      .bind(...hashes)
      .all<{ code_hash: string }>()
    return new Set(rows.results.map((r) => r.code_hash))
  },

  // Encrypt + hash a single item (shared by single + bulk).
  _prepare: async (env: Env['Bindings'], item: CreateDigitalVoucherRequest): Promise<PreparedItem> => {
    const [enc, hash] = await Promise.all([encryptCode(item.code, env), hashCode(item.code, env)])
    return {
      id: ulid(),
      voucherId: item.voucherId,
      subDistrictId: item.subDistrictId ?? null,
      hash,
      enc,
    }
  },

  _insertStmt: (db: D1Database, p: PreparedItem, userId: string): D1PreparedStatement =>
    db
      .prepare(
        `INSERT INTO digital_vouchers
          (id, voucher_id, sub_district_id, code_hash, encrypted_code, encryption_iv,
           encryption_tag, encryption_key_version, status, created_by_user_id, updated_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?)`,
      )
      .bind(
        p.id,
        p.voucherId,
        p.subDistrictId,
        p.hash,
        p.enc.encryptedCode,
        p.enc.iv,
        p.enc.tag,
        p.enc.keyVersion,
        userId,
        userId,
      ),

  createSingle: async (
    db: D1Database,
    env: Env['Bindings'],
    body: CreateDigitalVoucherRequest,
    userId: string,
  ): Promise<string> => {
    const prepared = await digitalVoucherService._prepare(env, body)

    // Conflict check (same scope as unique index).
    const conflicting = await digitalVoucherService._conflictingHashes(db, [prepared.hash])
    if (conflicting.has(prepared.hash)) {
      throw Object.assign(new Error('CODE_EXISTS'), { code: 'DV_CODE_EXISTS' })
    }

    await digitalVoucherService._insertStmt(db, prepared, userId).run()
    return prepared.id
  },

  // Bulk: all-or-nothing. Parallel encrypt, pre-check conflicts (external + internal),
  // single batched INSERT transaction. Throws {code:'DV_CODE_EXISTS'} on any conflict.
  createBulk: async (
    db: D1Database,
    env: Env['Bindings'],
    items: CreateDigitalVoucherRequest[],
    userId: string,
  ): Promise<number> => {
    const prepared = await Promise.all(items.map((it) => digitalVoucherService._prepare(env, it)))

    // Internal duplicates within this batch.
    const seen = new Set<string>()
    for (const p of prepared) {
      if (seen.has(p.hash)) throw Object.assign(new Error('DUPLICATE_CODE_IN_BATCH'), { code: 'DV_CODE_EXISTS' })
      seen.add(p.hash)
    }

    // External conflicts (existing available row with same code).
    const conflicting = await digitalVoucherService._conflictingHashes(db, prepared.map((p) => p.hash))
    if (conflicting.size > 0) throw Object.assign(new Error('CODE_EXISTS'), { code: 'DV_CODE_EXISTS' })

    await db.batch(prepared.map((p) => digitalVoucherService._insertStmt(db, p, userId)))
    return prepared.length
  },

  remove: async (db: D1Database, id: string, userId: string): Promise<boolean> => {
    const result = await db
      .prepare(`UPDATE digital_vouchers SET deleted_at = ${ISO}, deleted_by_user_id = ? WHERE id = ? AND deleted_at IS NULL`)
      .bind(userId, id)
      .run()
    return result.meta.changes > 0
  },
}
