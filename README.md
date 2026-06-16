# API Rules

## Error messages

- Semua pesan error yang tampil ke pengguna **wajib** menggunakan **bahasa Indonesia** yang umum dan mudah dipahami oleh awam.
- **Jangan** expose ID database mentah (ULID) di pesan error.
- Gunakan kalimat yang jelas dan alami, misal: `"Voucher tidak ditemukan"`, `"Pengguna tidak ditemukan"`, `"Stok tidak mencukupi untuk Voucher A"` — bukan `` `Voucher not found: ${id}` ``.
- Kode error internal (`RVS_NOT_FOUND`, `DV_VOUCHER_NOT_FOUND`, dll.) tetap dikembalikan di `meta.code` untuk keperluan programmatic, bukan untuk ditampilkan.
- Pengecualian: pesan error teknis di server-side (misal `SaleError`) boleh membawa informasi internal untuk logging/debugging, tapi pesan yang sampai ke pengguna tetap harus bersih.

## Timestamp storage

- All timestamps are stored and returned in **ISO 8601** format: `YYYY-MM-DDTHH:MM:SSZ` in **UTC** (e.g. `2026-02-14T08:30:11Z`).
- The `Z` suffix means UTC — clients parse it correctly with `new Date(...)` across all timezones.
- Source of truth for stored time is the database column — generate timestamps via SQL `strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`, not `new Date().toISOString()` in TS code. (For the rare case where TS must mint one itself, use the `now()` helper in `src/lib/datetime.ts`.)
- Date columns default to ISO at the migration level: `created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`.
- Do **not** use SQLite's `datetime('now')` (produces `YYYY-MM-DD HH:MM:SS` — space-separated, no zone, parsed as local time by `new Date()`).
- Migration `0021` backfills existing rows from the old `datetime('now')` format to ISO 8601.

## Field visibility

- Field `createdAt`, `updatedAt`, `deletedAt` tidak boleh ditampilkan di response API.
- Pengecualian: `createdAt` pada notification list item tetap ditampilkan.
- Internal DB types boleh tetap memakai snake_case (`created_at`, `updated_at`, `deleted_at`).
- `id`, `createdAt`, `updatedAt`, `deletedAt` adalah immutable fields — tidak boleh diubah/dihapus melalui proses update atau delete.

## Pagination

Gunakan **cursor-based pagination** untuk list endpoints yang mendukung infinite scroll / load more.

### Request

| Param    | Tipe    | Default | Keterangan                               |
|----------|---------|---------|------------------------------------------|
| `cursor` | string  | —       | ULID dari item terakhir halaman sebelumnya (tidak ada = halaman pertama) |
| `limit`  | integer | `20`    | Maks item per halaman (max `100`)        |

### Response

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "nextCursor": "01JEX..."
  }
}
```

- `meta.nextCursor` = `null` jika sudah tidak ada halaman berikutnya.
- `nextCursor` diisi dengan `id` (ULID) dari item terakhir di halaman saat ini — kirim nilai ini sebagai `cursor` pada request berikutnya.

### Aturan implementasi

- Gunakan ULID `id` sebagai cursor, karena ULID bersifat time-sortable (lexicographic order = chronological order).
- Query: `WHERE id < ? ORDER BY id DESC LIMIT ?` — fetch `limit + 1` rows untuk deteksi `nextCursor`.
- `nextCursor` = `null` jika row yang dikembalikan ≤ `limit`.
- `created_at` boleh tetap ada di ORDER BY untuk stabilitas, tapi cursor tetap menggunakan `id`.
- **Jangan** gunakan `OFFSET` — performa menurun drastis pada offset besar.
- **Jangan** gunakan `page`/`pageSize` untuk infinite scroll — gunakan cursor.
- Jika endpoint membutuhkan `total` count (misal untuk admin table), tambahkan `total` di response, tapi tetap gunakan cursor untuk data.
