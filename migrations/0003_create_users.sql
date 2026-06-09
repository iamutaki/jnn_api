-- Migration: 0003_create_users
-- Table: users
-- ID format: ULID
-- Password stored as HMAC-SHA256 hash

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY NOT NULL,  -- ULID
  username   TEXT UNIQUE,
  password   TEXT NOT NULL,              -- HMAC-SHA256 hashed
  name       TEXT NOT NULL,
  phone      TEXT UNIQUE,
  email      TEXT UNIQUE,
  address    TEXT,
  avatar     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT DEFAULT NULL
);

-- Indexes for unique lookups (SQLite UNIQUE already creates implicit index,
-- but explicit indexes help with partial lookups and soft-delete filters)
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE deleted_at IS NULL;
