export interface Voucher {
  id: string
  name: string
  price: number
  description: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CreateVoucherRequest {
  name: string
  price: number
  description?: string
}

export interface UpdateVoucherRequest {
  name?: string
  price?: number
  description?: string | null
}
