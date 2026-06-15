-- Migration: 0024_create_incremental_code_sequences
-- Table: incremental_code_sequences
-- Per-(config, period) monotonic counter. The code_generator UPSERT-increments
-- current_sequence atomically (ON CONFLICT ... DO UPDATE ... RETURNING) so
-- concurrent requests never receive the same number. period_key granularity
-- matches the config's reset_type (global | YYYY | YYYY-MM | YYYY-MM-DD).

CREATE TABLE IF NOT EXISTS incremental_code_sequences (
  id                  TEXT PRIMARY KEY NOT NULL,             -- ULID
  code_config_id      TEXT NOT NULL,
  period_key          TEXT NOT NULL,                         -- global | 2026 | 2026-06 | 2026-06-15
  current_sequence    INTEGER NOT NULL DEFAULT 0,

  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  deleted_at          TEXT DEFAULT NULL,

  created_by_user_id  TEXT DEFAULT NULL,
  updated_by_user_id  TEXT DEFAULT NULL,
  deleted_by_user_id  TEXT DEFAULT NULL,

  FOREIGN KEY (code_config_id)     REFERENCES incremental_code_configs(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id),
  FOREIGN KEY (deleted_by_user_id) REFERENCES users(id)
);

-- One counter per (config, period). Partial (convention).
CREATE UNIQUE INDEX IF NOT EXISTS idx_ics_config_period
  ON incremental_code_sequences(code_config_id, period_key)
  WHERE deleted_at IS NULL;
