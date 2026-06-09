export interface Notification {
  id: string
  userId: string
  title: string
  body: string
  type: string
  udid: string | null
  fcmToken: string | null
  image: string | null
  actionUrl: string | null
  payload: string | null
  isRead: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface NotificationListItem {
  id: string
  title: string
  body: string
  type: string
  image: string | null
  actionUrl: string | null
  payload: string | null
  isRead: boolean
  createdAt: string
}

export interface NotifSummary {
  total: number
  unread: number
}
