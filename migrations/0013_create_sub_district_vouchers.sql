-- Migration: 0013_create_sub_district_vouchers
-- Table: sub_district_vouchers
-- Junction table linking sub_districts (desa) to vouchers (produk)
-- One sub-district can sell many vouchers, no duplicates

CREATE TABLE IF NOT EXISTS sub_district_vouchers (
  id              TEXT PRIMARY KEY NOT NULL,
  sub_district_id TEXT NOT NULL,
  voucher_id      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at      TEXT DEFAULT NULL,
  FOREIGN KEY (sub_district_id) REFERENCES sub_districts(id),
  FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
  UNIQUE (sub_district_id, voucher_id)
);

CREATE INDEX IF NOT EXISTS idx_sdv_sub_district ON sub_district_vouchers(sub_district_id);
CREATE INDEX IF NOT EXISTS idx_sdv_voucher ON sub_district_vouchers(voucher_id);

