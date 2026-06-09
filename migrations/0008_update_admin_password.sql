-- Migration: 0008_update_admin_password
-- Update admin password to use Argon2id (m=19456, t=2, p=1)

UPDATE users
SET password = '$argon2id$v=19$m=19456,t=2,p=1$VALyf2UIPLmNlDLOQ03J+g==$1ess7Bo3oNsJ1AfGY0zfz46Awv7toLUPlVX1eA8x4Mc='
WHERE username = 'iamutaki';
