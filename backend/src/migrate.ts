import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, closeDatabase } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '../migrations');
const migrations = (await fs.readdir(migrationsDir))
  .filter((file) => file.endsWith('.sql'))
  .sort();
for (const migrationFile of migrations) {
  await query(await fs.readFile(path.join(migrationsDir, migrationFile), 'utf8'));
  console.log(`Applied ${migrationFile}.`);
}
console.log('Database migration complete.');
await closeDatabase();
