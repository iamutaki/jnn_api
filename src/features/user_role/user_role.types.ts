export interface UserRole {
  userId: string
  roleId: string
}

export interface AssignRoleRequest {
  userId: string
  roleIds: string[]
}

export interface UserWithRole {
  id: string
  name: string
}

export interface RoleForUser {
  id: string
  name: string
}
