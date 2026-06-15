-- Migration: 0009_create_device_tokens
-- Table: device_tokens
-- Stores FCM tokens per device (udid), one token per device.
-- A user may have multiple devices registered.

CREATE TABLE IF NOT EXISTS device_tokens (
  id         TEXT PRIMARY KEY NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id),
  udid       TEXT NOT NULL UNIQUE,
  fcm_token  TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  deleted_at TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_device_tokens_udid ON device_tokens(udid);
