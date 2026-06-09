import { Hono } from 'hono'
import { authMiddleware } from '../../../middlewares/auth'
import { dummyController } from '../controller/dummy.controller'

const dummyRoutes = new Hono()

// All dummy routes require authentication
dummyRoutes.use('/*', authMiddleware)

/**
 * CRUD Endpoints:
 *
 * GET    /dummy      → List all items
 * GET    /dummy/:id  → Get one item
 * POST   /dummy      → Create item       { title, description? }
 * PATCH    /dummy/:id  → Update item       { title?, description? }
 * DELETE /dummy/:id  → Delete item
 */
dummyRoutes.get('/', dummyController.list)
dummyRoutes.get('/:id', dummyController.getOne)
dummyRoutes.post('/', dummyController.create)
dummyRoutes.patch('/:id', dummyController.update)
dummyRoutes.delete('/:id', dummyController.remove)

export { dummyRoutes }
