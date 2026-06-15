-- Migration: 0018_create_reseller_voucher_sales
-- Table: reseller_voucher_sales
-- A sale of voucher codes to a reseller. Created in 'draft' (header + items
-- editable), then 'completed' — which atomically pulls codes from the
-- digital_vouchers pool and binds them to each sale item — or 'cancelled'.
-- The who/when of every transition is recorded in reseller_voucher_sale_logs.

CREATE TABLE IF NOT EXISTS reseller_voucher_sales (
  id                   TEXT PRIMARY KEY NOT NULL,              -- ULID
  reseller_id          TEXT NOT NULL,

  sale_no              TEXT NOT NULL,                          -- human-readable tracking number
  sale_date            TEXT NOT NULL,                          -- YYYY-MM-DD
  sale_month           TEXT NOT NULL,                          -- YYYY-MM, e.g. 2026-02

  total_qty            INTEGER NOT NULL DEFAULT 0,
  total_amount         INTEGER NOT NULL DEFAULT 0,             -- whole rupiah (matches vouchers.price)

  status               TEXT NOT NULL DEFAULT 'draft',          -- draft | completed | cancelled
  completed_at         TEXT DEFAULT NULL,
  cancelled_at         TEXT DEFAULT NULL,

  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  deleted_at           TEXT DEFAULT NULL,

  created_by_user_id   TEXT DEFAULT NULL,
  updated_by_user_id   TEXT DEFAULT NULL,
  deleted_by_user_id   TEXT DEFAULT NULL,

  FOREIGN KEY (reseller_id)        REFERENCES resellers(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id),
  FOREIGN KEY (deleted_by_user_id) REFERENCES users(id)
);

-- sale_no is globally unique (one tracking number never reused).
-- Partial: excludes soft-deleted sales.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rvs_sale_no
  ON reseller_voucher_sales(sale_no)
  WHERE deleted_at IS NULL;

-- Common lookups: a reseller's sales for a month, or sales by status.
CREATE INDEX IF NOT EXISTS idx_rvs_reseller_month
  ON reseller_voucher_sales(reseller_id, sale_month)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rvs_status
  ON reseller_voucher_sales(status)
  WHERE deleted_at IS NULL;
