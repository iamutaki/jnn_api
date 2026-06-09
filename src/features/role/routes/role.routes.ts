import { Hono } from 'hono'
import { authMiddleware } from '../../../middlewares/auth'
import type { Env } from '../../../types'
import { roleController } from '../controller/role.controller'

const roleRoutes = new Hono<Env>()

roleRoutes.use('/*', authMiddleware)

roleRoutes.get('/', roleController.list)
roleRoutes.get('/:id', roleController.getOne)
roleRoutes.post('/', roleController.create)
roleRoutes.patch('/:id', roleController.update)
roleRoutes.delete('/:id', roleController.remove)

export { roleRoutes }
