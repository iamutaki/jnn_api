export interface User {
  id: string
  username: string
  password: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  avatar: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface SafeUser {
  id: string
  username: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  avatar: string | null
  roles: string[]
}

export interface SafeUserListItem {
  id: string
  username: string
  name: string
  avatar: string | null
  roles: string[]
}

export interface CreateUserRequest {
  username: string
  password: string
  name: string
  phone?: string
  email?: string
  address?: string
  avatar?: string
  roleIds?: string[]
}

export interface UpdateUserRequest {
  username?: string
  password?: string | null
  name?: string
  phone?: string | null
  email?: string | null
  address?: string | null
  avatar?: string | null
  roleIds?: string[]
}
