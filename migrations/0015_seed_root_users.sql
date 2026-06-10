-- Migration: 0015_seed_root_users
-- Assign root role to iamutaki and bangrin
-- Root role ID: 01KTRQEZKSVRQWKVZX9BBVFVAK
-- iamutaki user ID: 01KTPXA4NXKZR058FRVTNBQR99
-- bangrin user ID: 01KTQ0DUMMY01

INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ('01KTPXA4NXKZR058FRVTNBQR99', '01KTRQEZKSVRQWKVZX9BBVFVAK');
INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ('01KTQ0DUMMY01', '01KTRQEZKSVRQWKVZX9BBVFVAK');
