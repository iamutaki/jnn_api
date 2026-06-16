/// <reference path="./global.d.ts" />
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
// @ts-ignore — provided by @cloudflare/vitest-pool-workers at runtime
import { env, SELF } from 'cloudflare:workers'
import { readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { tokenUtil } from '../src/lib/token'
import type { Env } from '../src/types'

// ─── Test setup ────────────────────────────────────────────────────────

const typedEnv = env as Env['Bindings'] & { DB: D1Database }
const TOKEN_SECRET = typedEnv.TOKEN_SECRET

let migrations: Awaited<ReturnType<typeof readD1Migrations>>

async function getToken(secret = TOKEN_SECRET) {
  return tokenUtil.signAccess({ sub: 'test-user', userId: 'test-user-id' }, secret)
}

// Like voucher.test.ts's fetchApp, but supports extra headers (for Idempotency-Key).
function fetchApp(path: string, options: {
  method?: string
  body?: unknown
  token?: string
  rawBody?: string
  idempotencyKey?: string
  extraHeaders?: Record<string, string>
} = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey
  if (options.extraHeaders) Object.assign(headers, options.extraHeaders)

  const fullPath = path.startsWith('/') ? `/v1${path}` : `/v1/${path}`

  return SELF.fetch(
    new Request(`https://test-host${fullPath}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.rawBody ?? (options.body ? JSON.stringify(options.body) : undefined),
    }),
  )
}

async function seedVoucher(name: string, price = 10000) {
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 26)
  await typedEnv.DB
    .prepare('INSERT INTO vouchers (id, name, price, description) VALUES (?, ?, ?, ?)')
    .bind(id, name, price, null)
    .run()
  return id
}

async function applyMigrations() {
  if (!migrations) migrations = await readD1Migrations('./migrations')
  // One statement per query (readD1Migrations splits on ';'); D1 prepare/run handles DDL.
  for (const migration of migrations) {
    for (const query of migration.queries) {
      await typedEnv.DB.prepare(query).run()
    }
  }
}

async function runSql(sql: string) {
  await typedEnv.DB.prepare(sql).run()
}

async function cleanTables() {
  // Hard-delete (not soft) so the partial idempotency index has no residue between tests.
  await runSql('DELETE FROM reseller_voucher_sale_item_digital_vouchers')
  await runSql('DELETE FROM reseller_voucher_sale_items')
  await runSql('DELETE FROM reseller_voucher_sale_logs')
  await runSql('DELETE FROM reseller_voucher_sales')
  await runSql('DELETE FROM vouchers')
}

async function activeSaleCount() {
  const row = await typedEnv.DB
    .prepare('SELECT COUNT(*) as c FROM reseller_voucher_sales WHERE deleted_at IS NULL')
    .first<{ c: number }>()
  return row?.c ?? 0
}

// ─── Tests ─────────────────────────────────────────────────────────────

describe('POST /reseller-voucher-sale — idempotency', () => {
  beforeAll(async () => {
    await applyMigrations()
  })

  beforeEach(async () => {
    await cleanTables()
  })

  it('creates a draft sale and returns its id (201)', async () => {
    const voucherId = await seedVoucher('V1')
    const token = await getToken()

    const res = await fetchApp('/reseller-voucher-sale', {
      method: 'POST',
      token,
      idempotencyKey: 'key-create-1',
      body: { saleDate: '2026-06-16', items: [{ voucherId, qty: 2 }] },
    })
    const body = await res.json() as any

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data.id).toEqual(expect.any(String))
    expect(await activeSaleCount()).toBe(1)
  })

  it('replays the same key → same id, 200, still one sale', async () => {
    const voucherId = await seedVoucher('V2')
    const token = await getToken()
    const payload = { saleDate: '2026-06-16', items: [{ voucherId, qty: 1 }] }

    const first = await fetchApp('/reseller-voucher-sale', {
      method: 'POST', token, idempotencyKey: 'key-replay', body: payload,
    })
    const firstBody = await first.json() as any
    expect(first.status).toBe(201)

    // Retry (network blip / double-click) with the identical key.
    const replay = await fetchApp('/reseller-voucher-sale', {
      method: 'POST', token, idempotencyKey: 'key-replay', body: payload,
    })
    const replayBody = await replay.json() as any

    expect(replay.status).toBe(200)                     // replay, not re-create
    expect(replayBody.data.id).toBe(firstBody.data.id)  // identical id
    expect(await activeSaleCount()).toBe(1)              // no duplicate

    // The single sale row carries the key.
    const row = await typedEnv.DB
      .prepare('SELECT idempotency_key FROM reseller_voucher_sales WHERE id = ?')
      .bind(firstBody.data.id)
      .first<{ idempotency_key: string }>()
    expect(row?.idempotency_key).toBe('key-replay')
  })

  it('different keys → distinct sales', async () => {
    const voucherId = await seedVoucher('V3')
    const token = await getToken()
    const payload = { saleDate: '2026-06-16', items: [{ voucherId, qty: 1 }] }

    const a = await (await fetchApp('/reseller-voucher-sale', {
      method: 'POST', token, idempotencyKey: 'key-A', body: payload,
    })).json() as any
    const b = await (await fetchApp('/reseller-voucher-sale', {
      method: 'POST', token, idempotencyKey: 'key-B', body: payload,
    })).json() as any

    expect(a.data.id).not.toBe(b.data.id)
    expect(await activeSaleCount()).toBe(2)
  })

  it('rejects missing Idempotency-Key header with 400', async () => {
    const voucherId = await seedVoucher('V4')
    const token = await getToken()

    const res = await fetchApp('/reseller-voucher-sale', {
      method: 'POST',
      token,
      body: { saleDate: '2026-06-16', items: [{ voucherId, qty: 1 }] },
    })
    const body = await res.json() as any

    expect(res.status).toBe(400)
    expect(body.meta.code).toBe('RVS_VALIDATION_ERROR')
    expect(await activeSaleCount()).toBe(0)
  })

  it('rejects an over-length Idempotency-Key with 400', async () => {
    const voucherId = await seedVoucher('V5')
    const token = await getToken()

    const res = await fetchApp('/reseller-voucher-sale', {
      method: 'POST',
      token,
      idempotencyKey: 'x'.repeat(256),
      body: { saleDate: '2026-06-16', items: [{ voucherId, qty: 1 }] },
    })
    const body = await res.json() as any

    expect(res.status).toBe(400)
    expect(body.meta.code).toBe('RVS_VALIDATION_ERROR')
    expect(await activeSaleCount()).toBe(0) // nothing created on invalid key
  })

  it('frees the key on soft-delete → retry creates a new sale', async () => {
    const voucherId = await seedVoucher('V6')
    const token = await getToken()
    const payload = { saleDate: '2026-06-16', items: [{ voucherId, qty: 1 }] }

    const created = await (await fetchApp('/reseller-voucher-sale', {
      method: 'POST', token, idempotencyKey: 'key-reuse', body: payload,
    })).json() as any

    // Soft-delete (drafts can be deleted) → the partial index drops this key.
    const del = await fetchApp(`/reseller-voucher-sale/${created.data.id}`, { method: 'DELETE', token })
    expect(del.status).toBe(204)

    // A retry with the same key now legitimately creates a NEW sale.
    const retry = await fetchApp('/reseller-voucher-sale', {
      method: 'POST', token, idempotencyKey: 'key-reuse', body: payload,
    })
    const retryBody = await retry.json() as any

    expect(retry.status).toBe(201)
    expect(retryBody.data.id).not.toBe(created.data.id)
  })
})
