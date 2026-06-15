-- Migration: 0002_create_roles
-- Table: roles
-- ID format: ULID

CREATE TABLE IF NOT EXISTS roles (
  id          TEXT PRIMARY KEY NOT NULL,  -- ULID
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  deleted_at  TEXT DEFAULT NULL
);
