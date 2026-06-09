-- Migration: 0010_create_notifications
-- Table: notifications
-- Stores push notification records per user.

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'general',
  udid       TEXT,
  fcm_token  TEXT,
  image      TEXT,
  action_url TEXT,
  payload    TEXT,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, created_at DESC) WHERE deleted_at IS NULL;
