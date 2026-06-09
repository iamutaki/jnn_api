import { Hono } from 'hono'
import { authMiddleware } from '../../../middlewares/auth'
import type { Env } from '../../../types'
import { userController } from '../controller/user.controller'

const userRoutes = new Hono<Env>()

userRoutes.use('/*', authMiddleware)

userRoutes.get('/', userController.list)
userRoutes.get('/:id', userController.getOne)
userRoutes.post('/', userController.create)
userRoutes.patch('/:id', userController.update)
userRoutes.delete('/:id', userController.remove)

export { userRoutes }
