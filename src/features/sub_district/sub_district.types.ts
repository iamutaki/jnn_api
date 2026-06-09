export interface SubDistrict {
  id: string
  district_id: string | null
  name: string
  code: string | null
  lat: number | null
  lng: number | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CreateSubDistrictRequest {
  districtId: string
  name: string
  code?: string
  lat?: number
  lng?: number
}

export interface UpdateSubDistrictRequest {
  districtId?: string
  name?: string
  code?: string | null
  lat?: number | null
  lng?: number | null
}
