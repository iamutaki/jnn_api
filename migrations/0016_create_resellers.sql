-- Migration: 0016_create_resellers
-- Table: resellers (1:1 with users)

CREATE TABLE IF NOT EXISTS resellers (
  id               TEXT PRIMARY KEY NOT NULL,
  venue_photo      TEXT,
  sub_district_id  TEXT NOT NULL,
  commission_rate  REAL NOT NULL DEFAULT 0,
  commission_amount REAL NOT NULL DEFAULT 0,
  lat              REAL,
  lng              REAL,
  phone            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at       TEXT DEFAULT NULL,
  FOREIGN KEY (id) REFERENCES users(id),
  FOREIGN KEY (sub_district_id) REFERENCES sub_districts(id)
);

CREATE INDEX IF NOT EXISTS idx_resellers_sub_district ON resellers(sub_district_id);
