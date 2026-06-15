# Notes & Konfirmasi

## Digital Voucher

- [ ] **Partial import** — `POST /bulk` saat ini all-or-nothing. Jika ada 1 duplikat dari 100 kode, 0 masuk. Apakah ingin diubah ke partial (skip duplikat, sisanya tetap masuk)?
- [ ] **Environment vars staging** — `VOUCHER_KEY_VERSION` dan `VOUCHER_ENCRYPTION_KEY_V1` harus diset di staging (dan environment lain) agar enkripsi berjalan.
- [ ] **Unique index** — sekarang scoped ke `(code_hash, sub_district_id)`. Kode yang sama untuk desa berbeda bisa coexist.
- [ ] **Import history** — `GET /v1/digital-voucher/imports` sudah siap (cursor-based pagination).
