import type { Context } from 'hono'
import { response } from '../../../lib/response'
import { safeJsonBody } from '../../../lib/request'
import type { Env } from '../../../types'
import { subDistrictVoucherService } from '../service/sub_district_voucher.service'

export const subDistrictVoucherController = {
  list: async (c: Context<Env>) => {
    const subDistrictId = c.req.param('subDistrictId') ?? ''
    const items = await subDistrictVoucherService.getAll(c.env.DB, subDistrictId)
    return response.success(c, items)
  },

  sync: async (c: Context<Env>) => {
    const subDistrictId = c.req.param('subDistrictId') ?? ''

    const body = await safeJsonBody(c)
    if (body instanceof Response) return body

    const voucherIds = body?.voucherIds
    if (!Array.isArray(voucherIds)) {
      return response.error(c, 'voucherIds must be an array', 400, 'SDV_VALIDATION_ERROR')
    }

    const sdExists = await subDistrictVoucherService._subDistrictExists(c.env.DB, subDistrictId)
    if (!sdExists) {
      return response.error(c, 'Sub-district not found', 400, 'SDV_SUB_DISTRICT_NOT_FOUND')
    }

    const seen = new Set<string>()
    for (const vId of voucherIds) {
      if (typeof vId !== 'string') {
        return response.error(c, 'Each voucherId must be a string', 400, 'SDV_VALIDATION_ERROR')
      }

      if (seen.has(vId)) {
        return response.error(c, `Duplicate voucher ID: ${vId}`, 400, 'SDV_VALIDATION_ERROR')
      }
      seen.add(vId)

      const vExists = await subDistrictVoucherService._voucherExists(c.env.DB, vId)
      if (!vExists) {
        return response.error(c, `Voucher not found: ${vId}`, 400, 'SDV_VOUCHER_NOT_FOUND')
      }
    }

    await subDistrictVoucherService.sync(c.env.DB, subDistrictId, { voucherIds })
    return response.noContent(c, 204)
  },
}
