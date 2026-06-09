export interface District {
  id: string
  name: string
  code: string | null
  lat: number | null
  lng: number | null
  created_at: string
  updated_at: string
}

export interface CreateDistrictRequest {
  name: string
  code?: string
  lat?: number
  lng?: number
}

export interface UpdateDistrictRequest {
  name?: string
  code?: string | null
  lat?: number | null
  lng?: number | null
}
