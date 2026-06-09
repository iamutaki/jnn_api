import type { Context } from 'hono'
import { response } from '../../../lib/response'
import { dummyService } from '../service/dummy.service'

export const dummyController = {
  list: (c: Context) => {
    const items = dummyService.getAll()
    return response.success(c, items)
  },

  getOne: (c: Context) => {
    const id = c.req.param('id') ?? ''
    const item = dummyService.getById(id)

    if (!item) {
      return response.error(c, 'Item not found', 404)
    }

    return response.success(c, item)
  },

  create: async (c: Context) => {
    const body = await c.req.json()

    if (!body.title) {
      return response.error(c, 'Title is required', 400)
    }

    const item = dummyService.create(body)
    return response.success(c, item, 201)
  },

  update: async (c: Context) => {
    const id = c.req.param('id') ?? ''
    const body = await c.req.json()
    const item = dummyService.update(id, body)

    if (!item) {
      return response.error(c, 'Item not found', 404)
    }

    return response.success(c, item)
  },

  remove: (c: Context) => {
    const id = c.req.param('id') ?? ''
    const deleted = dummyService.delete(id)

    if (!deleted) {
      return response.error(c, 'Item not found', 404)
    }

    return response.success(c, { message: 'Item deleted' })
  },
}
