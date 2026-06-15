import { Hono } from 'hono'
import { authMiddleware } from '../../../middlewares/auth'
import type { Env } from '../../../types'
import { profileController } from '../controller/profile.controller'

const profileRoutes = new Hono<Env>()

profileRoutes.use('/*', authMiddleware)

profileRoutes.get('/', profileController.get)
profileRoutes.get('/reseller', profileController.getReseller)
profileRoutes.patch('/', profileController.update)
profileRoutes.patch('/avatar', profileController.updateAvatar)
profileRoutes.patch('/change-password', profileController.changePassword)

export { profileRoutes }
