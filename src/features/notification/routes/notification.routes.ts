import { Hono } from 'hono'
import { authMiddleware } from '../../../middlewares/auth'
import type { Env } from '../../../types'
import { notificationController } from '../controller/notification.controller'

const notificationRoutes = new Hono<Env>()

notificationRoutes.use('/*', authMiddleware)

notificationRoutes.get('/', notificationController.list)
notificationRoutes.patch('/:id/read', notificationController.markRead)

export { notificationRoutes }
