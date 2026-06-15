-- Migration: 0006_alter_users_username_not_null
-- Make username NOT NULL for environments already running 0003

CREATE TABLE IF NOT EXISTS users_new (
  id         TEXT PRIMARY KEY NOT NULL,
  username   TEXT NOT NULL UNIQUE,
  password   TEXT NOT NULL,
  name       TEXT NOT NULL,
  phone      TEXT UNIQUE,
  email      TEXT UNIQUE,
  address    TEXT,
  avatar     TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  deleted_at TEXT DEFAULT NULL
);

INSERT INTO users_new (id, username, password, name, phone, email, address, avatar, created_at, updated_at, deleted_at)
  SELECT id, COALESCE(username, id), password, name, phone, email, address, avatar, created_at, updated_at, deleted_at
  FROM users;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE deleted_at IS NULL;
