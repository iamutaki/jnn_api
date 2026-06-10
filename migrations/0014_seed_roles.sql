-- Migration: 0014_seed_roles
-- Seed default roles

INSERT OR IGNORE INTO roles (id, name, description) VALUES ('01KTRQEZKSVRQWKVZX9BBVFVAK', 'root',     'Super administrator with full system access');
INSERT OR IGNORE INTO roles (id, name, description) VALUES ('01KTRQEZKW3YTGDFM3FVQYANX8', 'owner',    'Owner level with administrative privileges');
INSERT OR IGNORE INTO roles (id, name, description) VALUES ('01KTRQEZKW86HC3XFYPMNEC5DD', 'supervisor', 'Supervisor level for monitoring and oversight');
INSERT OR IGNORE INTO roles (id, name, description) VALUES ('01KTRQEZKWKX59M5D93VSA02R1', 'admin',    'Administrator level for daily operations');
INSERT OR IGNORE INTO roles (id, name, description) VALUES ('01KTRQEZKWR29C3T448087DE3Z', 'teknisi',  'Technical staff for field operations');
INSERT OR IGNORE INTO roles (id, name, description) VALUES ('01KTRQEZKWBYSD2J5FM0W3PGDD', 'petugas',  'Field officer for operational tasks');
