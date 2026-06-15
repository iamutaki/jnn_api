-- Migration: 0022_create_digital_vouchers
-- Table: digital_vouchers
-- The POOL of voucher CODES consumed by sales. The plaintext code is NEVER stored:
-- it is AES-256-GCM encrypted (encrypted_code + iv + tag) and a keyed HMAC
-- (code_hash) is stored for lookup-by-code without decrypting. Status starts
-- 'available'; flips to 'sold' (fills the sold_* fields) when a
-- reseller_voucher_sale is completed and pulls this code; flips back to
-- 'available' if that sale is later cancelled.

CREATE TABLE IF NOT EXISTS digital_vouchers (
  id                      TEXT PRIMARY KEY NOT NULL,             -- ULID
  voucher_id              TEXT NOT NULL,
  sub_district_id         TEXT DEFAULT NULL,

  code_hash               TEXT NOT NULL,                         -- HMAC-SHA256 of plaintext, base64 (lookup key)
  encrypted_code          TEXT NOT NULL,                         -- AES-256-GCM ciphertext, base64 (no tag)
  encryption_iv           TEXT NOT NULL,                         -- 96-bit IV, base64
  encryption_tag          TEXT NOT NULL,                         -- 128-bit GCM auth tag, base64
  encryption_key_version  INTEGER NOT NULL DEFAULT 1,            -- for key rotation

  status                  TEXT NOT NULL DEFAULT 'available',     -- available | sold | void | expired

  sold_to_reseller_id     TEXT DEFAULT NULL,
  sold_sale_id            TEXT DEFAULT NULL,
  sold_at                 TEXT DEFAULT NULL,
  sold_by_user_id         TEXT DEFAULT NULL,

  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  deleted_at              TEXT DEFAULT NULL,

  created_by_user_id      TEXT DEFAULT NULL,
  updated_by_user_id      TEXT DEFAULT NULL,
  deleted_by_user_id      TEXT DEFAULT NULL,

  FOREIGN KEY (voucher_id)          REFERENCES vouchers(id),
  FOREIGN KEY (sub_district_id)     REFERENCES sub_districts(id),
  FOREIGN KEY (sold_to_reseller_id) REFERENCES resellers(id),
  FOREIGN KEY (sold_sale_id)        REFERENCES reseller_voucher_sales(id),
  FOREIGN KEY (sold_by_user_id)     REFERENCES users(id),
  FOREIGN KEY (created_by_user_id)  REFERENCES users(id),
  FOREIGN KEY (updated_by_user_id)  REFERENCES users(id),
  FOREIGN KEY (deleted_by_user_id)  REFERENCES users(id)
);

-- Lookup-by-code: code_hash is the search key. Scoped unique — a code is blocked
-- only while an AVAILABLE, non-deleted row holds it. Once sold or soft-deleted,
-- the SAME code may be re-inserted (codes can be re-issued). DB constraint is the
-- backstop for the service-layer pre-check.
CREATE UNIQUE INDEX IF NOT EXISTS idx_dv_code_hash
  ON digital_vouchers(code_hash)
  WHERE deleted_at IS NULL AND status = 'available';

-- Allocation query: "available codes of voucher X in sub-district Y" (scoped), plus
-- the unscoped (NULL) fallback the completer merges in.
CREATE INDEX IF NOT EXISTS idx_dv_voucher_subdist_status
  ON digital_vouchers(voucher_id, sub_district_id, status)
  WHERE deleted_at IS NULL;

-- Reverse lookups: every code sold by a given sale (used by cancel/verify).
CREATE INDEX IF NOT EXISTS idx_dv_sold_sale
  ON digital_vouchers(sold_sale_id)
  WHERE sold_sale_id IS NOT NULL;
