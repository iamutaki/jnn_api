import { Hono } from 'hono'
import { authMiddleware, requireRoles } from '../../../middlewares/auth'
import type { Env } from '../../../types'
import { resellerController } from '../controller/reseller.controller'

const resellerRoutes = new Hono<Env>()

resellerRoutes.use('/*', authMiddleware)

/**
 * CRUD Endpoints:
 *
 * GET    /reseller      → List all resellers
 * GET    /reseller/:id  → Get one reseller
 * POST   /reseller      → Create reseller (creates user + reseller)
 * PATCH  /reseller/:id  → Update reseller (updates user + reseller)
 * DELETE /reseller/:id  → Delete reseller (soft delete reseller + user)
 */
resellerRoutes.get('/', requireRoles('root', 'owner', 'supervisor'), resellerController.list)
resellerRoutes.get('/:id', requireRoles('root', 'owner', 'supervisor'), resellerController.getOne)
resellerRoutes.post('/', requireRoles('root', 'owner', 'supervisor'), resellerController.create)
resellerRoutes.patch('/:id', requireRoles('root', 'owner', 'supervisor'), resellerController.update)
resellerRoutes.delete('/:id', requireRoles('root', 'owner', 'supervisor'), resellerController.remove)

export { resellerRoutes }
