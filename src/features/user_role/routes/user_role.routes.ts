import { Hono } from 'hono'
import { authMiddleware } from '../../../middlewares/auth'
import type { Env } from '../../../types'
import { userRoleController } from '../controller/user_role.controller'

const userRoleRoutes = new Hono<Env>()

userRoleRoutes.use('/*', authMiddleware)

userRoleRoutes.get('/user/:userId', userRoleController.listUserRoles)
userRoleRoutes.get('/role/:roleId', userRoleController.listRoleUsers)
userRoleRoutes.post('/', userRoleController.assign)
userRoleRoutes.delete('/user/:userId/role/:roleId', userRoleController.remove)

export { userRoleRoutes }
