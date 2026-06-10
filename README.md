# API Rules

- Field `createdAt`, `updatedAt`, `deletedAt` tidak boleh ditampilkan di response API.
- Pengecualian: `createdAt` pada notification list item tetap ditampilkan.
- Internal DB types boleh tetap memakai snake_case (`created_at`, `updated_at`, `deleted_at`).
- `id`, `createdAt`, `updatedAt`, `deletedAt` adalah immutable fields — tidak boleh diubah/dihapus melalui proses update atau delete.
