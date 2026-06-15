-- Migration: 0028_create_digital_voucher_imports
-- Table: digital_voucher_imports
-- Tracks every import batch (single or bulk) of digital voucher codes.
-- Each import groups one or more digital_vouchers under a single parent record
-- for activity rekap and audit trails.

CREATE TABLE IF NOT EXISTS digital_voucher_imports (
  id                  TEXT PRIMARY KEY NOT NULL,             -- ULID
  voucher_id          TEXT NOT NULL,
  sub_district_id     TEXT DEFAULT NULL,
  total_codes         INTEGER NOT NULL,
  notes               TEXT DEFAULT NULL,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_by_user_id  TEXT NOT NULL,

  FOREIGN KEY (voucher_id)         REFERENCES vouchers(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_dvi_voucher
  ON digital_voucher_imports(voucher_id);

CREATE INDEX IF NOT EXISTS idx_dvi_created_by
  ON digital_voucher_imports(created_by_user_id);

-- Link each digital_voucher to its import batch.
ALTER TABLE digital_vouchers ADD COLUMN import_id TEXT DEFAULT NULL;
