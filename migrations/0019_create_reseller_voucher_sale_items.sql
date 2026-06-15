-- Migration: 0019_create_reseller_voucher_sale_items
-- Table: reseller_voucher_sale_items
-- Line items of a reseller_voucher_sale: one row per voucher type in a sale.
-- On sale completion, each item's qty drives how many codes are pulled from the
-- digital_vouchers pool and bound to it (reseller_voucher_sale_item_digital_vouchers).

CREATE TABLE IF NOT EXISTS reseller_voucher_sale_items (
  id                  TEXT PRIMARY KEY NOT NULL,              -- ULID
  sale_id             TEXT NOT NULL,
  voucher_id          TEXT NOT NULL,

  qty                 INTEGER NOT NULL DEFAULT 0,
  unit_price          INTEGER NOT NULL DEFAULT 0,             -- whole rupiah (matches vouchers.price)
  total_amount        INTEGER NOT NULL DEFAULT 0,             -- qty * unit_price

  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  deleted_at          TEXT DEFAULT NULL,

  created_by_user_id  TEXT DEFAULT NULL,
  updated_by_user_id  TEXT DEFAULT NULL,
  deleted_by_user_id  TEXT DEFAULT NULL,

  FOREIGN KEY (sale_id)            REFERENCES reseller_voucher_sales(id),
  FOREIGN KEY (voucher_id)         REFERENCES vouchers(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id),
  FOREIGN KEY (deleted_by_user_id) REFERENCES users(id)
);

-- Business rule: a voucher type appears at most once per sale (qty aggregates).
-- Partial: excludes soft-deleted items (enables full-replace PATCH diffing).
CREATE UNIQUE INDEX IF NOT EXISTS idx_rvsi_sale_voucher
  ON reseller_voucher_sale_items(sale_id, voucher_id)
  WHERE deleted_at IS NULL;

-- Lookups: all items of a sale, or everywhere a voucher was sold.
CREATE INDEX IF NOT EXISTS idx_rvsi_sale
  ON reseller_voucher_sale_items(sale_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rvsi_voucher
  ON reseller_voucher_sale_items(voucher_id)
  WHERE deleted_at IS NULL;
