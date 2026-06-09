export interface DeviceToken {
  id: string
  userId: string
  udid: string
  fcmToken: string
}

export interface RegisterDeviceRequest {
  udid: string
  fcmToken: string
}

export interface RevokeDeviceRequest {
  udid: string
}
