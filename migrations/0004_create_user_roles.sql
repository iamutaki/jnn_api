-- Migration: 0004_create_user_roles
-- Table: user_roles (junction table for many-to-many relationship)
-- Composite PK prevents duplicate assignments

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Index for looking up all roles of a user
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
-- Index for looking up all users with a specific role
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
