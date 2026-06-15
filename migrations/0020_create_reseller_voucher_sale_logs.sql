-- Migration: 0020_create_reseller_voucher_sale_logs
-- Table: reseller_voucher_sale_logs
-- Append-only audit trail of reseller_voucher_sale status transitions (created,
-- completed, cancelled). One row per transition with old/new status + who/when.
-- Intentionally IMMUTABLE: no updated_at/deleted_at — history is never edited or
-- soft-deleted. This is a deliberate deviation from the "every table has audit
-- fields" convention, because an audit log must be tamper-evident.

CREATE TABLE IF NOT EXISTS reseller_voucher_sale_logs (
  id                   TEXT PRIMARY KEY NOT NULL,             -- ULID
  sale_id              TEXT NOT NULL,

  action               TEXT NOT NULL,                         -- created | completed | cancelled
  old_status           TEXT DEFAULT NULL,
  new_status           TEXT NOT NULL,

  changed_by_user_id   TEXT DEFAULT NULL,
  changed_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  note                 TEXT,

  FOREIGN KEY (sale_id)            REFERENCES reseller_voucher_sales(id),
  FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
);

-- Lookups: chronological history of a sale.
CREATE INDEX IF NOT EXISTS idx_rvsl_sale_changed
  ON reseller_voucher_sale_logs(sale_id, changed_at);
