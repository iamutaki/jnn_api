-- Migration: 0026_create_reseller_voucher_sale_item_digital_vouchers
-- Table: reseller_voucher_sale_item_digital_vouchers
-- Allocation link: which concrete digital_voucher code was pulled for which sale
-- item. Created atomically when a sale is completed (one row per allocated code).
-- If a completed sale is cancelled, these rows are soft-deleted and the bound code
-- is released back to the pool (digital_vouchers.status → 'available').
-- Partial unique on digital_voucher_id: a code is bound to at most one ACTIVE link,
-- but a reversed (soft-deleted) link does not block the code from being re-sold later.

CREATE TABLE IF NOT EXISTS reseller_voucher_sale_item_digital_vouchers (
  id                   TEXT PRIMARY KEY NOT NULL,             -- ULID
  sale_item_id         TEXT NOT NULL,
  digital_voucher_id   TEXT NOT NULL,

  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_by_user_id   TEXT DEFAULT NULL,
  deleted_at           TEXT DEFAULT NULL,
  deleted_by_user_id   TEXT DEFAULT NULL,

  FOREIGN KEY (sale_item_id)        REFERENCES reseller_voucher_sale_items(id),
  FOREIGN KEY (digital_voucher_id)  REFERENCES digital_vouchers(id),
  FOREIGN KEY (created_by_user_id)  REFERENCES users(id),
  FOREIGN KEY (deleted_by_user_id)  REFERENCES users(id)
);

-- A code is bound to at most one ACTIVE link. Soft-deleted links don't block re-sale.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rvsidv_digital_voucher
  ON reseller_voucher_sale_item_digital_vouchers(digital_voucher_id)
  WHERE deleted_at IS NULL;

-- Lookups: all codes allocated to a sale item.
CREATE INDEX IF NOT EXISTS idx_rvsidv_sale_item
  ON reseller_voucher_sale_item_digital_vouchers(sale_item_id)
  WHERE deleted_at IS NULL;
