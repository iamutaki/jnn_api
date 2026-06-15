# API Rules

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
