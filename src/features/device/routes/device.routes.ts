import { Hono } from 'hono'
import { authMiddleware } from '../../../middlewares/auth'
import type { Env } from '../../../types'
import { deviceController } from '../controller/device.controller'

const deviceRoutes = new Hono<Env>()

deviceRoutes.use('/*', authMiddleware)

deviceRoutes.post('/register', deviceController.register)
deviceRoutes.patch('/revoke', deviceController.revoke)

export { deviceRoutes }
