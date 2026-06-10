import { Hono } from 'hono'
import { authMiddleware } from '../../../middlewares/auth'
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
resellerRoutes.get('/', resellerController.list)
resellerRoutes.get('/:id', resellerController.getOne)
resellerRoutes.post('/', resellerController.create)
resellerRoutes.patch('/:id', resellerController.update)
resellerRoutes.delete('/:id', resellerController.remove)

export { resellerRoutes }
