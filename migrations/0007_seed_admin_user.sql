-- Migration: 0007_seed_admin_user
-- Seed the first admin user for bootstrapping

INSERT OR IGNORE INTO users (id, username, password, name)
VALUES (
  '01KTPXA4NXKZR058FRVTNBQR99',
  'iamutaki',
  '8ffec39e0dc4dd06fdcb80921faf30936fb461f00b306967676493f1dfc9cb9a',
  'Ibnul Mutaki'
);
