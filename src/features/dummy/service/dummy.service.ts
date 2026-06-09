import type { DummyItem, CreateDummyRequest, UpdateDummyRequest } from '../dummy.types'

/**
 * In-memory store for prototype.
 * In production, replace with D1 / KV / external database.
 *
 * Note: Cloudflare Workers are stateless — this data resets on each deployment.
 * For persistent storage, use Cloudflare D1 (SQLite) or KV.
 */
let items: DummyItem[] = [
  {
    id: '1',
    title: 'First dummy item',
    description: 'This is a prototype item',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

let nextId = 2

export const dummyService = {
  getAll: (): DummyItem[] => items,

  getById: (id: string): DummyItem | undefined => items.find((item) => item.id === id),

  create: (body: CreateDummyRequest): DummyItem => {
    const now = new Date().toISOString()
    const item: DummyItem = {
      id: String(nextId++),
      title: body.title,
      description: body.description ?? '',
      createdAt: now,
      updatedAt: now,
    }
    items.push(item)
    return item
  },

  update: (id: string, body: UpdateDummyRequest): DummyItem | null => {
    const index = items.findIndex((item) => item.id === id)
    if (index === -1) return null

    items[index] = {
      ...items[index],
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      updatedAt: new Date().toISOString(),
    }
    return items[index]
  },

  delete: (id: string): boolean => {
    const lengthBefore = items.length
    items = items.filter((item) => item.id !== id)
    return items.length !== lengthBefore
  },
}
