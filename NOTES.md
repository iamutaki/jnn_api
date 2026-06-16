# Notes & Konfirmasi

## Digital Voucher

- [x] **Partial import** — `POST /bulk` sekarang skip duplikat (internal + eksternal) dan insert sisanya. Response includes `created` + `skipped` count.
- [ ] **Environment vars staging** — `VOUCHER_KEY_VERSION` dan `VOUCHER_ENCRYPTION_KEY_V1` harus diset di staging (dan environment lain) agar enkripsi berjalan.
- [ ] **Unique index** — sekarang scoped ke `(code_hash, sub_district_id)`. Kode yang sama untuk desa berbeda bisa coexist.
- [ ] **Import history** — `GET /v1/digital-voucher/imports` sudah siap (cursor-based pagination).
