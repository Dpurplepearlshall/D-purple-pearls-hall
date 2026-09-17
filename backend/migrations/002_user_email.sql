ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(120);
UPDATE users SET email = username WHERE email IS NULL AND role <> 'owner';
