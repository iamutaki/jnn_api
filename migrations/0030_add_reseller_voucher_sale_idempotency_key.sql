-- Migration: 0030_add_reseller_voucher_sale_idempotency_key
-- Stable client-supplied key (Idempotency-Key header) that dedupes retries of the same
-- logical create. Partial UNIQUE index (deleted_at IS NULL) guarantees at most one ACTIVE
-- sale per key, and frees the key on soft-delete so a retry-after-delete can create a new
-- sale. SQLite treats NULLs as distinct in a UNIQUE index, so creates without a key are
-- unaffected.
ALTER TABLE reseller_voucher_sales ADD COLUMN idempotency_key TEXT DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rvs_idempotency_key
  ON reseller_voucher_sales(idempotency_key)
  WHERE deleted_at IS NULL;
