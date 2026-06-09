/// <reference path="./global.d.ts" />
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
// @ts-ignore — provided by @cloudflare/vitest-pool-workers at runtime
import { env } from 'cloudflare:workers'
// @ts-ignore — SELF is the app's default export, available via pool main config
import { SELF } from 'cloudflare:workers'
import { readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { jwtUtil } from '../src/lib/jwt'
import type { Env } from '../src/types'

// ─── Test setup ────────────────────────────────────────────────────────

const typedEnv = env as Env['Bindings'] & { DB: D1Database }
const JWT_SECRET = typedEnv.JWT_SECRET

let migrations: Awaited<ReturnType<typeof readD1Migrations>>

async function getToken(secret = JWT_SECRET) {
  return jwtUtil.signAccess({ sub: 'test-user', userId: 'test-user-id' }, secret)
}

async function getExpiredToken(secret = JWT_SECRET) {
  return jwtUtil.encrypt(secret, { sub: 'test-user', userId: 'test-user-id', exp: '2020-01-01T00:00:00Z' }, { addExp: false, addIat: false })
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

async function seedDistrict(data: {
  name: string
  code?: string
  lat?: number
  lng?: number
}) {
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 26)
  await typedEnv.DB
    .prepare('INSERT INTO districts (id, name, code, lat, lng) VALUES (?, ?, ?, ?, ?)')
    .bind(id, data.name, data.code ?? null, data.lat ?? null, data.lng ?? null)
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
  await typedEnv.DB.prepare('DELETE FROM districts').run()
}

// ─── Tests ─────────────────────────────────────────────────────────────

describe('District CRUD', () => {
  beforeAll(async () => {
    await applyMigrations()
  })

  beforeEach(async () => {
    await cleanTable()
  })

  // ─── LIST ──────────────────────────────────────────────────────────

  describe('GET /district', () => {
    it('returns empty list when no districts', async () => {
      const token = await getToken()
      const res = await fetchApp('/district', { token })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data).toEqual([])
    })

    it('returns all districts ordered by created_at desc', async () => {
      await seedDistrict({ name: 'Jakarta' })
      await seedDistrict({ name: 'Bandung' })

      const token = await getToken()
      const res = await fetchApp('/district', { token })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data).toHaveLength(2)
      expect(body.data[0].name).toBe('Bandung')
      expect(body.data[1].name).toBe('Jakarta')
    })
  })

  // ─── GET ONE ───────────────────────────────────────────────────────

  describe('GET /district/:id', () => {
    it('returns a single district by id', async () => {
      const id = await seedDistrict({ name: 'Jakarta Selatan', code: 'JKTS', lat: -6.2615, lng: 106.8106 })

      const token = await getToken()
      const res = await fetchApp(`/district/${id}`, { token })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.id).toBe(id)
      expect(body.data.name).toBe('Jakarta Selatan')
      expect(body.data.code).toBe('JKTS')
      expect(body.data.lat).toBe(-6.2615)
      expect(body.data.lng).toBe(106.8106)
    })

    it('returns 404 for non-existent id', async () => {
      const token = await getToken()
      const res = await fetchApp('/district/01KTPEHM5GJG3V2JBTTKXDKZW5', { token })
      const body = await res.json() as any

      expect(res.status).toBe(404)
      expect(body.success).toBe(false)
      expect(body.error).toBeDefined()
      expect(body.meta.code).toBe('DISTRICT_NOT_FOUND')
    })
  })

  // ─── CREATE ────────────────────────────────────────────────────────

  describe('POST /district', () => {
    it('creates a district with all fields', async () => {
      const token = await getToken()
      const res = await fetchApp('/district', {
        method: 'POST',
        token,
        body: { name: 'Surabaya', code: 'SBY', lat: -7.2575, lng: 112.7521 },
      })
      const body = await res.json() as any

      expect(res.status).toBe(201)
      expect(body.success).toBe(true)
      expect(body.data.name).toBe('Surabaya')
      expect(body.data.code).toBe('SBY')
      expect(body.data.lat).toBe(-7.2575)
      expect(body.data.lng).toBe(112.7521)
      expect(body.data.id).toBeDefined()
      expect(body.data.created_at).toBeDefined()
      expect(body.data.updated_at).toBeDefined()
    })

    it('creates a district with only required fields', async () => {
      const token = await getToken()
      const res = await fetchApp('/district', {
        method: 'POST',
        token,
        body: { name: 'Depok' },
      })
      const body = await res.json() as any

      expect(res.status).toBe(201)
      expect(body.success).toBe(true)
      expect(body.data.name).toBe('Depok')
      expect(body.data.code).toBeNull()
      expect(body.data.lat).toBeNull()
      expect(body.data.lng).toBeNull()
    })

    it('returns 400 when body is empty', async () => {
      const token = await getToken()
      const res = await fetchApp('/district', {
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
      const res = await fetchApp('/district', {
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
      const res = await fetchApp('/district', {
        method: 'POST',
        token,
        body: { code: 'TEST' },
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.meta.code).toBe('DISTRICT_VALIDATION_ERROR')
      expect(body.error).toContain('name is required')
    })

    it('returns 400 when name is empty string', async () => {
      const token = await getToken()
      const res = await fetchApp('/district', {
        method: 'POST',
        token,
        body: { name: '' },
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.error).toContain('name is required')
    })

    it('returns 400 when name is not a string', async () => {
      const token = await getToken()
      const res = await fetchApp('/district', {
        method: 'POST',
        token,
        body: { name: 12345 },
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.error).toContain('name must be a string')
    })

    it('returns 400 when lat is not a number', async () => {
      const token = await getToken()
      const res = await fetchApp('/district', {
        method: 'POST',
        token,
        body: { name: 'Test', lat: 'not-a-number' },
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.error).toContain('lat must be a number')
    })

    it('returns 400 when lng is not a number', async () => {
      const token = await getToken()
      const res = await fetchApp('/district', {
        method: 'POST',
        token,
        body: { name: 'Test', lng: false },
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.error).toContain('lng must be a number')
    })

    it('persists the created district in database', async () => {
      const token = await getToken()
      const res = await fetchApp('/district', {
        method: 'POST',
        token,
        body: { name: 'Bekasi', code: 'BKS' },
      })
      const body = await res.json() as any

      const saved = await typedEnv.DB
        .prepare('SELECT * FROM districts WHERE id = ?')
        .bind(body.data.id)
        .first()

      expect(saved).toBeDefined()
      expect(saved!.name).toBe('Bekasi')
      expect(saved!.code).toBe('BKS')
    })
  })

  // ─── UPDATE ────────────────────────────────────────────────────────

  describe('PATCH /district/:id', () => {
    it('updates all fields of a district', async () => {
      const id = await seedDistrict({ name: 'Old Name', code: 'OLD' })

      const token = await getToken()
      const res = await fetchApp(`/district/${id}`, {
        method: 'PATCH',
        token,
        body: { name: 'New Name', code: 'NEW', lat: 1.0, lng: 2.0 },
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.name).toBe('New Name')
      expect(body.data.code).toBe('NEW')
      expect(body.data.lat).toBe(1.0)
      expect(body.data.lng).toBe(2.0)
    })

    it('partially updates only name', async () => {
      const id = await seedDistrict({ name: 'Jakarta', code: 'JKT', lat: -6.2, lng: 106.8 })

      const token = await getToken()
      const res = await fetchApp(`/district/${id}`, {
        method: 'PATCH',
        token,
        body: { name: 'Jakarta Baru' },
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.name).toBe('Jakarta Baru')
      expect(body.data.code).toBe('JKT')
      expect(body.data.lat).toBe(-6.2)
      expect(body.data.lng).toBe(106.8)
    })

    it('can set optional fields to null', async () => {
      const id = await seedDistrict({ name: 'Test', code: 'CODE', lat: 1.0, lng: 2.0 })

      const token = await getToken()
      const res = await fetchApp(`/district/${id}`, {
        method: 'PATCH',
        token,
        body: { code: null, lat: null, lng: null },
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.code).toBeNull()
      expect(body.data.lat).toBeNull()
      expect(body.data.lng).toBeNull()
    })

    it('returns 400 when body is empty on update', async () => {
      const id = await seedDistrict({ name: 'Test' })
      const token = await getToken()

      const res = await fetchApp(`/district/${id}`, {
        method: 'PATCH',
        token,
        rawBody: '',
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.meta.code).toBe('VALIDATION_EMPTY_BODY')
    })

    it('returns 400 when name is empty string on update', async () => {
      const id = await seedDistrict({ name: 'Test' })
      const token = await getToken()

      const res = await fetchApp(`/district/${id}`, {
        method: 'PATCH',
        token,
        body: { name: '' },
      })
      const body = await res.json() as any

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.error).toContain('name must be at least 1 characters')
    })

    it('returns 404 for non-existent district', async () => {
      const token = await getToken()
      const res = await fetchApp('/district/01KTPEHM5GJG3V2JBTTKXDKZW5', {
        method: 'PATCH',
        token,
        body: { name: 'Ghost' },
      })
      const body = await res.json() as any

      expect(res.status).toBe(404)
      expect(body.success).toBe(false)
      expect(body.meta.code).toBe('DISTRICT_NOT_FOUND')
    })

    it('updates updated_at timestamp', async () => {
      const id = await seedDistrict({ name: 'Original' })

      const original = await typedEnv.DB
        .prepare('SELECT updated_at FROM districts WHERE id = ?')
        .bind(id)
        .first()

      const token = await getToken()
      await fetchApp(`/district/${id}`, {
        method: 'PATCH',
        token,
        body: { name: 'Updated' },
      })

      const updated = await typedEnv.DB
        .prepare('SELECT updated_at FROM districts WHERE id = ?')
        .bind(id)
        .first()

      expect(updated!.updated_at).not.toBe(original!.updated_at)
    })
  })

  // ─── DELETE ────────────────────────────────────────────────────────

  describe('DELETE /district/:id', () => {
    it('deletes an existing district', async () => {
      const id = await seedDistrict({ name: 'ToDelete' })

      const token = await getToken()
      const res = await fetchApp(`/district/${id}`, {
        method: 'DELETE',
        token,
      })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)

      const check = await typedEnv.DB
        .prepare('SELECT * FROM districts WHERE id = ?')
        .bind(id)
        .first()
      expect(check).toBeNull()
    })

    it('returns 404 for non-existent district', async () => {
      const token = await getToken()
      const res = await fetchApp('/district/01KTPEHM5GJG3V2JBTTKXDKZW5', {
        method: 'DELETE',
        token,
      })
      const body = await res.json() as any

      expect(res.status).toBe(404)
      expect(body.success).toBe(false)
      expect(body.meta.code).toBe('DISTRICT_NOT_FOUND')
    })

    it('deleting same district twice returns 404', async () => {
      const id = await seedDistrict({ name: 'ToDelete' })
      const token = await getToken()

      const res1 = await fetchApp(`/district/${id}`, { method: 'DELETE', token })
      expect(res1.status).toBe(200)

      const res2 = await fetchApp(`/district/${id}`, { method: 'DELETE', token })
      expect(res2.status).toBe(404)
    })
  })

  // ─── AUTH GUARD ────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('rejects request without token', async () => {
      const res = await fetchApp('/district')
      const body = await res.json() as any

      expect(res.status).toBe(401)
      expect(body.success).toBe(false)
      expect(body.meta.code).toBe('AUTH_MISSING_TOKEN')
    })

    it('rejects request with malformed authorization header', async () => {
      const res = await SELF.fetch(
        new Request('https://test-host/district', {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Basic abc123',
          },
        }),
      )
      const body = await res.json() as any

      expect(res.status).toBe(401)
      expect(body.success).toBe(false)
    })

    it('rejects request with invalid token', async () => {
      const res = await fetchApp('/district', {
        token: 'invalid.jwt.token',
      })
      const body = await res.json() as any

      expect(res.status).toBe(401)
      expect(body.success).toBe(false)
      expect(body.meta.code).toBe('AUTH_INVALID_TOKEN')
    })

    it('rejects request with expired token', async () => {
      const expiredToken = await getExpiredToken()
      const res = await fetchApp('/district', {
        token: expiredToken,
      })
      const body = await res.json() as any

      expect(res.status).toBe(401)
      expect(body.success).toBe(false)
      expect(body.meta.code).toBe('AUTH_INVALID_TOKEN')
    })

    it('rejects request with wrong secret', async () => {
      const wrongSecretToken = await getToken('k4.local.WvNisWzWSm8YJkVMj7jHCFCwaV6Gd8mSgGj27e4crQA')
      const res = await fetchApp('/district', {
        token: wrongSecretToken,
      })
      const body = await res.json() as any

      expect(res.status).toBe(401)
      expect(body.success).toBe(false)
    })

    it('allows request with valid token', async () => {
      const token = await getToken()
      const res = await fetchApp('/district', { token })
      const body = await res.json() as any

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
    })
  })
})
