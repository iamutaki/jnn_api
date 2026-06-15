-- Migration: 0001_create_districts
-- Table: districts
-- ID format: ULID (26-char lexicographically sortable)

CREATE TABLE IF NOT EXISTS districts (
  id         TEXT PRIMARY KEY NOT NULL,  -- ULID
  name       TEXT NOT NULL,
  code       TEXT,
  lat        REAL,
  lng        REAL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  deleted_at TEXT DEFAULT NULL
);

-- Index for faster lookups by name (exclude soft-deleted)
CREATE INDEX IF NOT EXISTS idx_districts_name ON districts(name);
