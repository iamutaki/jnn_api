import { ulid } from '../../../lib/ulid'
import { encryptCode, decryptCode, hashCode } from '../../../lib/voucher-crypto'
import type { Env } from '../../../types'
import type {
  DigitalVoucher,
  DigitalVoucherListItem,
  DigitalVoucherDetail,
  DigitalVoucherImportItem,
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
        `SELECT id, voucher_id, sub_district_id, import_id, status, sold_to_reseller_id, sold_sale_id, sold_at
           FROM digital_vouchers
          WHERE deleted_at IS NULL
          ORDER BY created_at DESC`,
      )
      .all<any>()
    return result.results.map((r: any) => ({
      id: r.id,
      voucherId: r.voucher_id,
      subDistrictId: r.sub_district_id,
      importId: r.import_id,
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
      importId: row.import_id,
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
      importId: row.import_id,
      status: row.status,
      soldToResellerId: row.sold_to_reseller_id,
      soldSaleId: row.sold_sale_id,
      soldAt: row.sold_at,
      code: plaintext,
    }
  },

  getImports: async (
    db: D1Database,
    cursor?: string,
    limit = 20,
  ): Promise<{ items: DigitalVoucherImportItem[]; nextCursor: string | null }> => {
    // Fetch limit + 1 to detect if there's a next page.
    const fetchLimit = limit + 1

    let sql = `SELECT imp.id, imp.voucher_id, imp.sub_district_id, imp.total_codes, imp.notes, imp.created_at, imp.created_by_user_id,
                      v.name AS voucher_name, v.price AS voucher_price,
                      sd.name AS sub_district_name, sd.district_id,
                      d.name AS district_name
                 FROM digital_voucher_imports imp
                 JOIN vouchers v ON v.id = imp.voucher_id
                 LEFT JOIN sub_districts sd ON sd.id = imp.sub_district_id
                 LEFT JOIN districts d ON d.id = sd.district_id`

    const bind: unknown[] = []

    if (cursor) {
      sql += ' WHERE imp.id < ?'
      bind.push(cursor)
    }

    sql += ' ORDER BY imp.id DESC LIMIT ?'
    bind.push(fetchLimit)

    const result = await db.prepare(sql).bind(...bind).all<any>()

    const rows = result.results
    const hasMore = rows.length > limit
    if (hasMore) rows.pop()

    const items = rows.map((r: any) => ({
      id: r.id,
      voucher: {
        id: r.voucher_id,
        name: r.voucher_name,
        price: r.voucher_price,
      },
      subDistrict: r.sub_district_id
        ? {
            id: r.sub_district_id,
            name: r.sub_district_name,
            district: {
              id: r.district_id,
              name: r.district_name,
            },
          }
        : null,
      totalCodes: r.total_codes,
      notes: r.notes,
      createdAt: r.created_at,
      createdByUserId: r.created_by_user_id,
    }))

    return { items, nextCursor: hasMore ? rows[rows.length - 1].id : null }
  },

  _voucherExists: async (db: D1Database, id: string): Promise<boolean> => {
    const row = await db.prepare('SELECT 1 FROM vouchers WHERE id = ? AND deleted_at IS NULL').bind(id).first()
    return row !== null
  },

  _subDistrictExists: async (db: D1Database, id: string): Promise<boolean> => {
    const row = await db.prepare('SELECT 1 FROM sub_districts WHERE id = ?').bind(id).first()
    return row !== null
  },

  // Returns the subset of hashes that already have an AVAILABLE, non-deleted row
  // for the SAME (hash, sub_district_id) pair. Same scope as the unique index.
  _conflictingPairs: async (
    db: D1Database,
    pairs: { hash: string; subDistrictId: string | null }[],
  ): Promise<Set<string>> => {
    if (pairs.length === 0) return new Set()

    const orClauses: string[] = []
    const bind: unknown[] = []

    for (const p of pairs) {
      if (p.subDistrictId !== null) {
        orClauses.push('(code_hash = ? AND sub_district_id = ?)')
        bind.push(p.hash, p.subDistrictId)
      } else {
        orClauses.push('(code_hash = ? AND sub_district_id IS NULL)')
        bind.push(p.hash)
      }
    }

    const sql = `SELECT code_hash, sub_district_id FROM digital_vouchers
                  WHERE (${orClauses.join(' OR ')})
                    AND status = 'available' AND deleted_at IS NULL`

    const rows = await db.prepare(sql).bind(...bind).all<{ code_hash: string; sub_district_id: string | null }>()

    return new Set(rows.results.map((r) => `${r.code_hash}:${r.sub_district_id ?? ''}`))
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

  _insertImportStmt: (db: D1Database, importId: string, voucherId: string, subDistrictId: string | null, totalCodes: number, userId: string): D1PreparedStatement =>
    db
      .prepare(
        `INSERT INTO digital_voucher_imports
          (id, voucher_id, sub_district_id, total_codes, created_by_user_id)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(importId, voucherId, subDistrictId, totalCodes, userId),

  _insertStmt: (db: D1Database, p: PreparedItem, userId: string, importId: string): D1PreparedStatement =>
    db
      .prepare(
        `INSERT INTO digital_vouchers
          (id, voucher_id, sub_district_id, import_id, code_hash, encrypted_code, encryption_iv,
           encryption_tag, encryption_key_version, status, created_by_user_id, updated_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?)`,
      )
      .bind(
        p.id,
        p.voucherId,
        p.subDistrictId,
        importId,
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
  ): Promise<{ id: string; importId: string }> => {
    const importId = ulid()
    const prepared = await digitalVoucherService._prepare(env, body)

    // Conflict check per (hash, sub_district_id) pair.
    const conflicting = await digitalVoucherService._conflictingPairs(db, [
      { hash: prepared.hash, subDistrictId: prepared.subDistrictId },
    ])
    if (conflicting.size > 0) {
      throw Object.assign(new Error('CODE_EXISTS'), { code: 'DV_CODE_EXISTS' })
    }

    await db.batch([
      digitalVoucherService._insertImportStmt(db, importId, prepared.voucherId, prepared.subDistrictId, 1, userId),
      digitalVoucherService._insertStmt(db, prepared, userId, importId),
    ])

    return { id: prepared.id, importId }
  },

  // Bulk: all-or-nothing. Parallel encrypt, pre-check conflicts (external + internal),
  // single batched INSERT transaction. Throws {code:'DV_CODE_EXISTS'} on any conflict.
  createBulk: async (
    db: D1Database,
    env: Env['Bindings'],
    items: CreateDigitalVoucherRequest[],
    userId: string,
  ): Promise<{ count: number; importIds: string[] }> => {
    const prepared = await Promise.all(items.map((it) => digitalVoucherService._prepare(env, it)))

    // Internal duplicates within this batch.
    const seen = new Set<string>()
    for (const p of prepared) {
      if (seen.has(p.hash)) throw Object.assign(new Error('DUPLICATE_CODE_IN_BATCH'), { code: 'DV_CODE_EXISTS' })
      seen.add(p.hash)
    }

    // External conflicts — check per (hash, sub_district_id) pair.
    const conflicting = await digitalVoucherService._conflictingPairs(
      db,
      prepared.map((p) => ({ hash: p.hash, subDistrictId: p.subDistrictId })),
    )
    if (conflicting.size > 0) throw Object.assign(new Error('CODE_EXISTS'), { code: 'DV_CODE_EXISTS' })

    // Group by voucherId — each group gets its own import record.
    const groups = new Map<string, PreparedItem[]>()
    for (const p of prepared) {
      const arr = groups.get(p.voucherId) ?? []
      arr.push(p)
      groups.set(p.voucherId, arr)
    }

    const importIds: string[] = []
    const stmts: D1PreparedStatement[] = []

    for (const [voucherId, group] of groups) {
      const importId = ulid()
      importIds.push(importId)

      const nonNullSd = group.find((p) => p.subDistrictId !== null)
      const sdId = nonNullSd?.subDistrictId ?? null

      stmts.push(digitalVoucherService._insertImportStmt(db, importId, voucherId, sdId, group.length, userId))
      for (const p of group) {
        stmts.push(digitalVoucherService._insertStmt(db, p, userId, importId))
      }
    }

    await db.batch(stmts)
    return { count: prepared.length, importIds }
  },

  remove: async (db: D1Database, id: string, userId: string): Promise<boolean> => {
    const result = await db
      .prepare(`UPDATE digital_vouchers SET deleted_at = ${ISO}, deleted_by_user_id = ? WHERE id = ? AND deleted_at IS NULL`)
      .bind(userId, id)
      .run()
    return result.meta.changes > 0
  },
}
