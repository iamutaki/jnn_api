-- Migration: 0025_seed_sale_code_config
-- Seed the 'sale' code config: format SLE-<monthly> → e.g. SLE-2026060001
--   prefix          : 'SLE-'
--   reset_type      : 'monthly'  (counter resets each month → period_key YYYY-MM)
--   date_format     : 'YYYYMM'   (date token rendered into the code)
--   sequence_length : 4          (0001..9999 per month)
-- Adjust this row to change the format; the code_generator reads it live.

INSERT INTO incremental_code_configs
  (id, code_type, prefix, reset_type, date_format, sequence_length, is_active)
VALUES
  ('01KTSALECFG000000000000000', 'sale', 'SLE-', 'monthly', 'YYYYMM', 4, 1)
ON CONFLICT DO NOTHING;
