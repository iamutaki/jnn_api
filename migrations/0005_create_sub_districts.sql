-- Migration: 0005_create_sub_districts
-- Table: sub_districts
-- ID format: ULID (26-char lexicographically sortable)
-- district_id references districts, SET NULL on delete

CREATE TABLE IF NOT EXISTS sub_districts (
  id          TEXT PRIMARY KEY NOT NULL,  -- ULID
  district_id TEXT,
  name        TEXT NOT NULL,
  code        TEXT,
  lat         REAL,
  lng         REAL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT DEFAULT NULL,
  FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE SET NULL
);

-- Index for faster lookups by district
CREATE INDEX IF NOT EXISTS idx_sub_districts_district ON sub_districts(district_id);
-- Index for faster lookups by name
CREATE INDEX IF NOT EXISTS idx_sub_districts_name ON sub_districts(name);
