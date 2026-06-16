import { Hono } from 'hono'
import { authMiddleware, requireRoles } from '../../../middlewares/auth'
import type { Env } from '../../../types'
import { subDistrictController } from '../controller/sub_district.controller'

const subDistrictRoutes = new Hono<Env>()

// All sub-district routes require authentication
subDistrictRoutes.use('/*', authMiddleware)

/**
 * CRUD Endpoints:
 *
 * GET    /sub-district         → List all sub-districts (id, name)
 * GET    /sub-district/:id     → Get one sub-district
 * POST   /sub-district         → Create sub-district  { district_id, name, code?, lat?, lng? }
 * PATCH    /sub-district/:id     → Update sub-district  { district_id?, name?, code?, lat?, lng? }
 * DELETE /sub-district/:id     → Delete sub-district
 */
subDistrictRoutes.get('/', subDistrictController.list)
subDistrictRoutes.get('/:id', subDistrictController.getOne)
subDistrictRoutes.post('/', requireRoles('root', 'owner', 'supervisor'), subDistrictController.create)
subDistrictRoutes.patch('/:id', requireRoles('root', 'owner', 'supervisor'), subDistrictController.update)
subDistrictRoutes.delete('/:id', requireRoles('root', 'owner', 'supervisor'), subDistrictController.remove)

export { subDistrictRoutes }
