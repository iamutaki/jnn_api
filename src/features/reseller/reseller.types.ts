export interface Reseller {
  id: string
  venue_photo: string | null
  sub_district_id: string
  commission_rate: number
  commission_amount: number
  lat: number | null
  lng: number | null
  phone: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ResellerResponse {
  id: string
  name: string
  username: string
  avatar: string | null
  venuePhoto: string | null
  subDistrictId: string
  subDistrictName: string
  commissionRate: number
  commissionAmount: number
  lat: number | null
  lng: number | null
  phone: string | null
}

export interface CreateResellerRequest {
  name: string
  username: string
  password: string
  avatar?: string
  phone?: string
  venuePhoto?: string
  subDistrictId: string
  commissionRate?: number
  commissionAmount?: number
  lat?: number
  lng?: number
}

export interface UpdateResellerRequest {
  name?: string
  username?: string
  password?: string
  avatar?: string | null
  phone?: string | null
  venuePhoto?: string | null
  subDistrictId?: string
  commissionRate?: number
  commissionAmount?: number
  lat?: number | null
  lng?: number | null
}
