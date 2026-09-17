import { closeDatabase, query } from './db.js';
import { config } from './config.js';
import { hashPassword } from './auth.js';

if (!config.ownerUsername || !config.ownerPassword) {
  throw new Error('OWNER_USERNAME and OWNER_PASSWORD must be set to seed an owner account.');
}
if (config.ownerPassword.length < 8) {
  throw new Error('OWNER_PASSWORD must be at least 8 characters.');
}
const passwordHash = await hashPassword(config.ownerPassword);
await query(
  `INSERT INTO users (username, password_hash, role, display_name)
   VALUES ($1, $2, 'owner', 'System owner')
   ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'owner'`,
  [config.ownerUsername, passwordHash]
);
console.log(`Owner account ready for ${config.ownerUsername}.`);
await closeDatabase();
