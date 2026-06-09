import { Hono } from 'hono'
import type { Env } from '../../../types'
import { authController } from '../controller/auth.controller'

const authRoutes = new Hono<Env>()

authRoutes.post('/login', authController.login)

export { authRoutes }
