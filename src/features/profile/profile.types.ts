export interface ProfileResponse {
  id: string
  username: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  avatar: string | null
  roles: string[]
}

export interface UpdateProfileRequest {
  name?: string
  phone?: string | null
  email?: string | null
  address?: string | null
}

export interface UpdateAvatarRequest {
  avatar: string
}
