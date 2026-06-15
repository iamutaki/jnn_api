-- Migration: 0021_backfill_timestamps_to_iso8601
-- Purpose: convert existing timestamp values from SQLite's datetime('now')
--          format (YYYY-MM-DD HH:MM:SS, space-separated, no zone) to ISO 8601
--          (YYYY-MM-DDTHH:MM:SSZ).
--
-- Why: strftime('%Y-%m-%dT%H:%M:%SZ', <value>) parses both formats and emits
--      ISO 8601, so this is SAFE to run on rows already in ISO format (no-op)
--      and preserves NULLs. Verified idempotent + null-safe before writing.
--
-- Scope: only columns known to hold timestamps across existing tables.
--        (Tables created by migrations 0018–0026 use ISO 8601 column defaults,
--        so they need no backfill here.)

-- Common audit columns on every table that has them.
UPDATE districts              SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at) WHERE created_at IS NOT NULL;
UPDATE districts              SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at) WHERE updated_at IS NOT NULL;
UPDATE districts              SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', deleted_at) WHERE deleted_at IS NOT NULL;

UPDATE roles                  SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at) WHERE created_at IS NOT NULL;
UPDATE roles                  SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at) WHERE updated_at IS NOT NULL;
UPDATE roles                  SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', deleted_at) WHERE deleted_at IS NOT NULL;

UPDATE users                  SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at) WHERE created_at IS NOT NULL;
UPDATE users                  SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at) WHERE updated_at IS NOT NULL;
UPDATE users                  SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', deleted_at) WHERE deleted_at IS NOT NULL;

UPDATE sub_districts          SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at) WHERE created_at IS NOT NULL;
UPDATE sub_districts          SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at) WHERE updated_at IS NOT NULL;
UPDATE sub_districts          SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', deleted_at) WHERE deleted_at IS NOT NULL;

UPDATE device_tokens          SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at) WHERE created_at IS NOT NULL;
UPDATE device_tokens          SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at) WHERE updated_at IS NOT NULL;
UPDATE device_tokens          SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', deleted_at) WHERE deleted_at IS NOT NULL;

UPDATE notifications          SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at) WHERE created_at IS NOT NULL;
UPDATE notifications          SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at) WHERE updated_at IS NOT NULL;
UPDATE notifications          SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', deleted_at) WHERE deleted_at IS NOT NULL;

UPDATE vouchers               SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at) WHERE created_at IS NOT NULL;
UPDATE vouchers               SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at) WHERE updated_at IS NOT NULL;
UPDATE vouchers               SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', deleted_at) WHERE deleted_at IS NOT NULL;

UPDATE sub_district_vouchers  SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at) WHERE created_at IS NOT NULL;
UPDATE sub_district_vouchers  SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at) WHERE updated_at IS NOT NULL;
UPDATE sub_district_vouchers  SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', deleted_at) WHERE deleted_at IS NOT NULL;

UPDATE resellers              SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at) WHERE created_at IS NOT NULL;
UPDATE resellers              SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at) WHERE updated_at IS NOT NULL;
UPDATE resellers              SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', deleted_at) WHERE deleted_at IS NOT NULL;
