import type { Context } from 'hono'
import { response } from '../../../lib/response'
import type { Env } from '../../../types'
import { districtService } from '../service/district.service'

export const districtController = {
  list: async (c: Context<Env>) => {
    const items = await districtService.getAll(c.env.DB)
    return response.success(c, items)
  },

  getOne: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    const item = await districtService.getById(c.env.DB, id)

    if (!item) {
      return response.error(c, 'District not found', 404)
    }

    return response.success(c, item)
  },

  create: async (c: Context<Env>) => {
    const body = await c.req.json()

    if (!body.name) {
      return response.error(c, 'Name is required', 400)
    }

    const item = await districtService.create(c.env.DB, body)
    return response.success(c, item, 201)
  },

  update: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    const body = await c.req.json()
    const item = await districtService.update(c.env.DB, id, body)

    if (!item) {
      return response.error(c, 'District not found', 404)
    }

    return response.success(c, item)
  },

  remove: async (c: Context<Env>) => {
    const id = c.req.param('id') ?? ''
    const deleted = await districtService.remove(c.env.DB, id)

    if (!deleted) {
      return response.error(c, 'District not found', 404)
    }

    return response.success(c, { message: 'District deleted' })
  },
}
