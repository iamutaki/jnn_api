-- Migration: 0007_seed_admin_user
-- Seed the first admin user for bootstrapping

INSERT OR IGNORE INTO users (id, username, password, name)
VALUES (
  '01KTPXA4NXKZR058FRVTNBQR99',
  'iamutaki',
  '$argon2id$v=19$m=19456,t=2,p=1$VALyf2UIPLmNlDLOQ03J+g==$1ess7Bo3oNsJ1AfGY0zfz46Awv7toLUPlVX1eA8x4Mc=',
  'Ibnul Mutaki'
);
