export interface SubDistrictVoucher {
  id: string
  sub_district_id: string
  voucher_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface SubDistrictVoucherResponse {
  id: string
  name: string
  price: number
}

export interface SyncSubDistrictVoucherRequest {
  voucherIds: string[]
}
