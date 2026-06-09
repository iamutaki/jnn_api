export interface DummyItem {
  id: string
  title: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface CreateDummyRequest {
  title: string
  description?: string
}

export interface UpdateDummyRequest {
  title?: string
  description?: string
}
