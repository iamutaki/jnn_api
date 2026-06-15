-- Migration: 0023_create_incremental_code_configs
-- Table: incremental_code_configs
-- Defines the format rules for each type of business code (sale, purchase,
-- reseller, ...). Drives the code_generator service. One active row per
-- code_type (e.g. 'sale' → prefix 'SLE-', monthly reset, YYYYMM).

CREATE TABLE IF NOT EXISTS incremental_code_configs (
  id                  TEXT PRIMARY KEY NOT NULL,             -- ULID
  code_type           TEXT NOT NULL,                         -- sale | purchase | reseller | ...
  prefix              TEXT NOT NULL,                         -- SHP- | PRC | RSL | SLE
  reset_type          TEXT NOT NULL,                         -- global | daily | monthly | yearly
  date_format         TEXT DEFAULT NULL,                     -- YYYYMM | YYMMDD | YYYY | NULL (global)
  sequence_length     INTEGER NOT NULL DEFAULT 3,            -- pad count → 001, 0001, ...
  is_active           INTEGER NOT NULL DEFAULT 1,            -- 0/1 boolean

  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  deleted_at          TEXT DEFAULT NULL,

  created_by_user_id  TEXT DEFAULT NULL,
  updated_by_user_id  TEXT DEFAULT NULL,
  deleted_by_user_id  TEXT DEFAULT NULL,

  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id),
  FOREIGN KEY (deleted_by_user_id) REFERENCES users(id)
);

-- One active config per code_type.
CREATE UNIQUE INDEX IF NOT EXISTS idx_icc_code_type
  ON incremental_code_configs(code_type)
  WHERE deleted_at IS NULL;
