-- Migration: 0027_seed_system_reseller
-- Fallback "System" reseller for sales created by non-reseller users (e.g. admins).
--
-- In sale create, the reseller_id is determined server-side from the caller (never from
-- the request body): a caller that has a resellers row is attributed to their own
-- reseller_id; everyone else is attributed to THIS System reseller — a bypass so such
-- sales don't need a real reseller.
--
-- The System reseller is region-agnostic (sub_district_id NULL) → complete() allocates
-- codes pool-wide (any available code of the voucher, FIFO). Its user cannot log in
-- (password is a disabled marker, not a valid argon2 hash).
--
-- The id MUST match SYSTEM_RESELLER_ID in src/features/reseller_voucher_sale/service/
-- reseller_voucher_sale.service.ts.

INSERT OR IGNORE INTO users (id, username, password, name)
VALUES ('01KT0SYSTEM000000000000000', 'system', '!disabled', 'System');

INSERT OR IGNORE INTO resellers (id, sub_district_id, commission_rate, commission_amount)
VALUES ('01KT0SYSTEM000000000000000', NULL, 0, 0);
