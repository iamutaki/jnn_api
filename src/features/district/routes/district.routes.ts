import { Hono } from 'hono'
import { authMiddleware, requireRoles } from '../../../middlewares/auth'
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
 * PATCH    /district/:id  → Update district  { name?, code?, lat?, lng? }
 * DELETE /district/:id  → Delete district
 */
districtRoutes.get('/', districtController.list)
districtRoutes.get('/:id', districtController.getOne)
districtRoutes.post('/', requireRoles('root', 'owner', 'supervisor'), districtController.create)
districtRoutes.patch('/:id', requireRoles('root', 'owner', 'supervisor'), districtController.update)
districtRoutes.delete('/:id', requireRoles('root', 'owner', 'supervisor'), districtController.remove)

export { districtRoutes }
