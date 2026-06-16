import { Hono } from 'hono'
import { authMiddleware, requireRoles } from '../../../middlewares/auth'
import type { Env } from '../../../types'
import { roleController } from '../controller/role.controller'

const roleRoutes = new Hono<Env>()

roleRoutes.use('/*', authMiddleware)

roleRoutes.get('/', roleController.list)
roleRoutes.get('/:id', roleController.getOne)
roleRoutes.post('/', requireRoles('root', 'owner', 'supervisor'), roleController.create)
roleRoutes.patch('/:id', requireRoles('root', 'owner', 'supervisor'), roleController.update)
roleRoutes.delete('/:id', requireRoles('root', 'owner', 'supervisor'), roleController.remove)

export { roleRoutes }
