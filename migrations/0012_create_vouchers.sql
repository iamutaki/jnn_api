-- Migration: 0012_create_vouchers
-- Table: vouchers

CREATE TABLE IF NOT EXISTS vouchers (
  id          TEXT PRIMARY KEY NOT NULL,
  name        TEXT NOT NULL,
  price       INTEGER NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  deleted_at  TEXT DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vouchers_name ON vouchers(name) WHERE deleted_at IS NULL;
