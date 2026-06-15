-- Migration: 0029_reindex_digital_vouchers_code_hash_sub_district
-- Scope uniqueness per (code_hash, sub_district_id) pair so the same
-- plaintext code can coexist across different desa/kecamatan.

DROP INDEX IF EXISTS idx_dv_code_hash;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dv_code_hash_sub_district
  ON digital_vouchers(code_hash, sub_district_id)
  WHERE deleted_at IS NULL AND status = 'available';
