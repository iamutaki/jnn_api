import { Hono } from 'hono'
import { authController } from '../controller/auth.controller'

const authRoutes = new Hono()

/**
 * POST /auth/login
 *
 * Request body: { username: string, password: string }
 * Response:     { success: true, data: { token, user } }
 */
authRoutes.post('/login', authController.login)

export { authRoutes }
