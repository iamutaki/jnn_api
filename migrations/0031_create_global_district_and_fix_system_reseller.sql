-- Migration: 0031_create_global_district_and_fix_system_reseller
-- Creates a "Global" district and sub_district for the system reseller,
-- replacing the previous NULL sub_district_id approach.

INSERT OR IGNORE INTO districts (id, name)
VALUES ('01KV7226A7YVVE93Y36S2TC9XF', 'Global');

INSERT OR IGNORE INTO sub_districts (id, name, district_id)
VALUES ('01KV7227XXH72FYPKM3Q8RHQ49', 'Global', '01KV7226A7YVVE93Y36S2TC9XF');

INSERT OR IGNORE INTO resellers (id, sub_district_id, commission_rate, commission_amount)
VALUES ('01KT0SYSTEM000000000000000', '01KV7227XXH72FYPKM3Q8RHQ49', 0, 0);
