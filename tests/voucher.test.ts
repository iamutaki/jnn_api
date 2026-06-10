/// <reference path="./global.d.ts" />
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
// @ts-ignore — provided by @cloudflare/vitest-pool-workers at runtime
import { env } from 'cloudflare:workers'
// @ts-ignore — SELF is the app's default export, available via pool main config
import { SELF } from 'cloudflare:workers'
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

async function getExpiredToken(secret = TOKEN_SECRET) {
  return tokenUtil.encrypt(secret, { sub: 'test-user', userId: 'test-user-id', exp: '2020-01-01T00:00:00Z' }, { addExp: false, addIat: false })
}

function fetchApp(path: string, options: {
  method?: string
  body?: unknown
  token?: string
  rawBody?: string
} = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`

  const fullPath = path.startsWith('/') ? `/v1${path}` : `/v1/${path}`

  return SELF.fetch(
    new Request(`https://test-host${fullPath}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.rawBody ?? (options.body ? JSON.stringify(options.body) : undefined),
    }),
  )
}

async function seedVoucher(data: {
  name: string
  price: number
  description?: string
}) {
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 26)
  await typedEnv.DB
    .prepare('INSERT INTO vouchers (id, name, price, description) VALUES (?, ?, ?, ?)')
    .bind(id, data.name, data.price, data.description ?? null)
    .run()
  return id
}

async function applyMigrations() {
  if (!migrations) migrations = await readD1Migrations('./migrations')
  for (const migration of migrations) {
    for (const query of migration.queries) {
      await typedEnv.DB.exec(query)
    }
  }
}

async function cleanTable() {
  await typedEnv.DB.prepare('DELETE FROM vouchers').run()
}

// ─── Tests ─────────────────────────────────────────────────────────────

describe('Voucher CRUD', () => {
  beforeAll(async () => {
    await applyMigrations()
  })

  beforeEach(async () => {
    await cleanTable()
  })

  // ─── LIST ──────────────────────────────────────────────────────────

  describe('GET /voucher', () => {
    it('returns empty list when no vouchers', async () => {
      const token = await getToken()
      const res = await fetchApp('/voucher', { token })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data).toEqual([])
    })

    it('returns all vouchers ordered by created_at desc', async () => {
      await seedVoucher({ name: 'Voucher A', price: 10000 })
      await seedVoucher({ name: 'Voucher B', price: 20000 })

      const token = await getToken()
      const res = await fetchApp('/voucher', { token })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data).toHaveLength(2)
      expect(body.data[0].name).toBe('Voucher B')
      expect(body.data[1].name).toBe('Voucher A')
    })
  })

  // ─── GET ONE ───────────────────────────────────────────────────────

  describe('GET /voucher/:id', () => {
    it('returns a single voucher by id', async () => {
      const id = await seedVoucher({ name: 'Discount 50%', price: 50000, description: 'Half price voucher' })

      const token = await getToken()
      const res = await fetchApp(`/voucher/${id}`, { token })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.id).toBe(id)
      expect(body.data.name).toBe('Discount 50%')
      expect(body.data.price).toBe(50000)
      expect(body.data.description).toBe('Half price voucher')
    })

    it('returns 404 for non-existent id', async () => {
      const token = await getToken()
      const res = await fetchApp('/voucher/01KTPEHM5GJG3V2JBTTKXDKZW5', { token })
      const body = await res.json() as any

      expect(res.status).toBe(404)
      expect(body.success).toBe(false)
      expect(body.error).toBeDefined()
      expect(body.meta.code).toBe('VOUCHER_NOT_FOUND')
    })
  })

  // ─── CREATE ────────────────────────────────────────────────────────

  describe('POST /voucher', () => {
    it('creates a voucher with all fields', async () => {
      const token = await getToken()
      const res = await fetchApp('/voucher', {
        method: 'POST',
        token,
        body: { name: 'Summer Sale', price: 25000, description: 'Summer discount' },
      })

      expect(res.status).toBe(201)
    })

    it('creates a voucher with only required fields', async () => {
      const token = await getToken()
      const res = await fetchApp('/voucher', {
        method: 'POST',
        token,
        body: { name: 'Basic', price: 10000 },
      })

      expect(res.status).toBe(201)
    })

    it('persists the created voucher in database', async () => {
      const token = await getToken()
      await fetchApp('/voucher', {
        method: 'POST',
        token,
        body: { name: 'Flash Sale', price: 15000, description: 'Limited time' },
      })

      const saved = await typedEnv.DB
        .prepare('SELECT * FROM vouchers WHERE name = ?')
        .bind('Flash Sale')
        .first()

      expect(saved).toBeDefined()
      expect(saved!.name).toBe('Flash Sale')
      expect(saved!.price).toBe(15000)
      expect(saved!.description).toBe('Limited time')
    })

    it('returns 400 when body is empty', async () => {
      const token = await getToken()
      const res = await fetchApp('/voucher', {
        method: 'POST',
        token,
        rawBody: '',
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.meta.code).toBe('VALIDATION_EMPTY_BODY')
    })

    it('returns 400 when body is invalid JSON', async () => {
      const token = await getToken()
      const res = await fetchApp('/voucher', {
        method: 'POST',
        token,
        rawBody: 'not json{{{',
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.meta.code).toBe('VALIDATION_INVALID_JSON')
    })

    it('returns 400 when name is missing', async () => {
      const token = await getToken()
      const res = await fetchApp('/voucher', {
        method: 'POST',
        token,
        body: { price: 10000 },
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.meta.code).toBe('VOUCHER_VALIDATION_ERROR')
      expect(body.error).toContain('name is required')
    })

    it('returns 400 when name is too short (min 2 chars)', async () => {
      const token = await getToken()
      const res = await fetchApp('/voucher', {
        method: 'POST',
        token,
        body: { name: 'A', price: 10000 },
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.error).toContain('name must be at least 2 characters')
    })

    it('returns 400 when name is empty string', async () => {
      const token = await getToken()
      const res = await fetchApp('/voucher', {
        method: 'POST',
        token,
        body: { name: '', price: 10000 },
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.error).toContain('name is required')
    })

    it('returns 400 when name is not a string', async () => {
      const token = await getToken()
      const res = await fetchApp('/voucher', {
        method: 'POST',
        token,
        body: { name: 12345, price: 10000 },
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.error).toContain('name must be a string')
    })

    it('returns 400 when price is missing', async () => {
      const token = await getToken()
      const res = await fetchApp('/voucher', {
        method: 'POST',
        token,
        body: { name: 'No Price' },
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.error).toContain('price is required')
    })

    it('returns 400 when price is not a number', async () => {
      const token = await getToken()
      const res = await fetchApp('/voucher', {
        method: 'POST',
        token,
        body: { name: 'Bad Price', price: 'cheap' },
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.error).toContain('price must be a number')
    })

    it('returns 400 when price is not an integer', async () => {
      const token = await getToken()
      const res = await fetchApp('/voucher', {
        method: 'POST',
        token,
        body: { name: 'Float Price', price: 99.99 },
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.error).toContain('Price must be an integer')
    })

    it('returns 409 when name already exists', async () => {
      await seedVoucher({ name: 'Duplicate' })
      const token = await getToken()
      const res = await fetchApp('/voucher', {
        method: 'POST',
        token,
        body: { name: 'Duplicate', price: 10000 },
      })
      const body = await res.json() as any

      expect(res.status).toBe(409)
      expect(body.success).toBe(false)
      expect(body.meta.code).toBe('VOUCHER_NAME_EXISTS')
    })
  })

  // ─── UPDATE ────────────────────────────────────────────────────────

  describe('PATCH /voucher/:id', () => {
    it('updates all fields of a voucher', async () => {
      const id = await seedVoucher({ name: 'Old Name', price: 10000 })

      const token = await getToken()
      const res = await fetchApp(`/voucher/${id}`, {
        method: 'PATCH',
        token,
        body: { name: 'New Name', price: 20000, description: 'Updated desc' },
      })

      expect(res.status).toBe(204)
    })

    it('partially updates only name', async () => {
      const id = await seedVoucher({ name: 'Original', price: 10000, description: 'Keep me' })

      const token = await getToken()
      const res = await fetchApp(`/voucher/${id}`, {
        method: 'PATCH',
        token,
        body: { name: 'Updated' },
      })

      expect(res.status).toBe(204)

      const updated = await typedEnv.DB
        .prepare('SELECT * FROM vouchers WHERE id = ?')
        .bind(id)
        .first()
      expect(updated!.name).toBe('Updated')
      expect(updated!.price).toBe(10000)
      expect(updated!.description).toBe('Keep me')
    })

    it('partially updates only price', async () => {
      const id = await seedVoucher({ name: 'Price Test', price: 5000 })

      const token = await getToken()
      const res = await fetchApp(`/voucher/${id}`, {
        method: 'PATCH',
        token,
        body: { price: 9999 },
      })

      expect(res.status).toBe(204)

      const updated = await typedEnv.DB
        .prepare('SELECT * FROM vouchers WHERE id = ?')
        .bind(id)
        .first()
      expect(updated!.price).toBe(9999)
      expect(updated!.name).toBe('Price Test')
    })

    it('returns 400 when body is empty on update', async () => {
      const id = await seedVoucher({ name: 'Test', price: 100 })
      const token = await getToken()

      const res = await fetchApp(`/voucher/${id}`, {
        method: 'PATCH',
        token,
        rawBody: '',
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.meta.code).toBe('VALIDATION_EMPTY_BODY')
    })

    it('returns 400 when name is too short on update', async () => {
      const id = await seedVoucher({ name: 'Test', price: 100 })
      const token = await getToken()

      const res = await fetchApp(`/voucher/${id}`, {
        method: 'PATCH',
        token,
        body: { name: 'A' },
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.error).toContain('name must be at least 2 characters')
    })

    it('returns 400 when price is not an integer on update', async () => {
      const id = await seedVoucher({ name: 'Test', price: 100 })
      const token = await getToken()

      const res = await fetchApp(`/voucher/${id}`, {
        method: 'PATCH',
        token,
        body: { price: 12.5 },
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.error).toContain('Price must be an integer')
    })

    it('returns 404 for non-existent voucher', async () => {
      const token = await getToken()
      const res = await fetchApp('/voucher/01KTPEHM5GJG3V2JBTTKXDKZW5', {
        method: 'PATCH',
        token,
        body: { name: 'Ghost' },
      })
      const body = await res.json() as any

      expect(res.status).toBe(404)
      expect(body.success).toBe(false)
      expect(body.meta.code).toBe('VOUCHER_NOT_FOUND')
    })

    it('returns 409 when updating name to an existing name', async () => {
      await seedVoucher({ name: 'Taken' })
      const id = await seedVoucher({ name: 'Original', price: 100 })

      const token = await getToken()
      const res = await fetchApp(`/voucher/${id}`, {
        method: 'PATCH',
        token,
        body: { name: 'Taken' },
      })
      const body = await res.json() as any

      expect(res.status).toBe(409)
      expect(body.success).toBe(false)
      expect(body.meta.code).toBe('VOUCHER_NAME_EXISTS')
    })

    it('updates updated_at timestamp', async () => {
      const id = await seedVoucher({ name: 'Original', price: 100 })

      const original = await typedEnv.DB
        .prepare('SELECT updated_at FROM vouchers WHERE id = ?')
        .bind(id)
        .first()

      const token = await getToken()
      await fetchApp(`/voucher/${id}`, {
        method: 'PATCH',
        token,
        body: { name: 'Updated' },
      })

      const updated = await typedEnv.DB
        .prepare('SELECT updated_at FROM vouchers WHERE id = ?')
        .bind(id)
        .first()

      expect(updated!.updated_at).not.toBe(original!.updated_at)
    })
  })

  // ─── DELETE ────────────────────────────────────────────────────────

  describe('DELETE /voucher/:id', () => {
    it('deletes an existing voucher', async () => {
      const id = await seedVoucher({ name: 'ToDelete', price: 100 })

      const token = await getToken()
      const res = await fetchApp(`/voucher/${id}`, {
        method: 'DELETE',
        token,
      })

      expect(res.status).toBe(204)
    })

    it('soft-deletes the voucher (sets deleted_at)', async () => {
      const id = await seedVoucher({ name: 'SoftDelete', price: 100 })

      const token = await getToken()
      await fetchApp(`/voucher/${id}`, { method: 'DELETE', token })

      const row = await typedEnv.DB
        .prepare('SELECT * FROM vouchers WHERE id = ?')
        .bind(id)
        .first()

      expect(row).toBeDefined()
      expect(row!.deleted_at).not.toBeNull()
    })

    it('returns 404 for non-existent voucher', async () => {
      const token = await getToken()
      const res = await fetchApp('/voucher/01KTPEHM5GJG3V2JBTTKXDKZW5', {
        method: 'DELETE',
        token,
      })
      const body = await res.json() as any

      expect(res.status).toBe(404)
      expect(body.success).toBe(false)
      expect(body.meta.code).toBe('VOUCHER_NOT_FOUND')
    })

    it('deleting same voucher twice returns 404', async () => {
      const id = await seedVoucher({ name: 'ToDelete', price: 100 })
      const token = await getToken()

      const res1 = await fetchApp(`/voucher/${id}`, { method: 'DELETE', token })
      expect(res1.status).toBe(204)

      const res2 = await fetchApp(`/voucher/${id}`, { method: 'DELETE', token })
      expect(res2.status).toBe(404)
    })
  })

  // ─── AUTH GUARD ────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('rejects request without token', async () => {
      const res = await fetchApp('/voucher')
      const body = await res.json() as any

      expect(res.status).toBe(401)
      expect(body.success).toBe(false)
      expect(body.meta.code).toBe('AUTH_MISSING_TOKEN')
    })

    it('rejects request with invalid token', async () => {
      const res = await fetchApp('/voucher', {
        token: 'invalid.paseto.token',
      })
      const body = await res.json() as any

      expect(res.status).toBe(401)
      expect(body.success).toBe(false)
      expect(body.meta.code).toBe('AUTH_INVALID_TOKEN')
    })

    it('rejects request with expired token', async () => {
      const expiredToken = await getExpiredToken()
      const res = await fetchApp('/voucher', {
        token: expiredToken,
      })
      const body = await res.json() as any

      expect(res.status).toBe(401)
      expect(body.success).toBe(false)
      expect(body.meta.code).toBe('AUTH_INVALID_TOKEN')
    })

    it('allows request with valid token', async () => {
      const token = await getToken()
      const res = await fetchApp('/voucher', { token })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
    })
  })
})
