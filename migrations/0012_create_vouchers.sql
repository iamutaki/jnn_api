-- Migration: 0012_create_vouchers
-- Table: vouchers

CREATE TABLE IF NOT EXISTS vouchers (
  id          TEXT PRIMARY KEY NOT NULL,
  name        TEXT NOT NULL,
  price       INTEGER NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vouchers_name ON vouchers(name) WHERE deleted_at IS NULL;
