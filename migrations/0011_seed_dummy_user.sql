-- Migration: 0011_seed_dummy_user
-- Seed a dummy user for testing

INSERT OR IGNORE INTO users (id, username, password, name)
VALUES (
  '01KTQ0DUMMY01',
  'bangrin',
  '$argon2id$v=19$m=19456,t=2,p=1$pyJNq02LUSg7SLaGj7BMFg==$ohO2i3n9Yyy+j3740ukgsB6TQ7kPUmlEO6wZ3aHaCl0=',
  'Rino'
);
