import { Hono } from 'hono'
import { authMiddleware, requireRoles } from '../../../middlewares/auth'
import type { Env } from '../../../types'
import { userController } from '../controller/user.controller'

const userRoutes = new Hono<Env>()

userRoutes.use('/*', authMiddleware)

userRoutes.get('/', requireRoles('root', 'owner', 'supervisor'), userController.list)
userRoutes.get('/:id', requireRoles('root', 'owner', 'supervisor'), userController.getOne)
userRoutes.post('/', requireRoles('root', 'owner', 'supervisor'), userController.create)
userRoutes.patch('/:id', requireRoles('root', 'owner', 'supervisor'), userController.update)
userRoutes.delete('/:id', requireRoles('root', 'owner', 'supervisor'), userController.remove)

export { userRoutes }
