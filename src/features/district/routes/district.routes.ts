import { Hono } from 'hono'
import { authMiddleware } from '../../../middlewares/auth'
import type { Env } from '../../../types'
import { districtController } from '../controller/district.controller'

const districtRoutes = new Hono<Env>()

// All district routes require authentication
districtRoutes.use('/*', authMiddleware)

/**
 * CRUD Endpoints:
 *
 * GET    /district      → List all districts
 * GET    /district/:id  → Get one district
 * POST   /district      → Create district  { name, code?, lat?, lng? }
 * PUT    /district/:id  → Update district  { name?, code?, lat?, lng? }
 * DELETE /district/:id  → Delete district
 */
districtRoutes.get('/', districtController.list)
districtRoutes.get('/:id', districtController.getOne)
districtRoutes.post('/', districtController.create)
districtRoutes.put('/:id', districtController.update)
districtRoutes.delete('/:id', districtController.remove)

export { districtRoutes }
