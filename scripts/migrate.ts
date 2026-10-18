// Applies db/migrations/*.sql in order. Every migration is idempotent, so
// re-running is safe.  Usage: npm run db:migrate
import './_env.js';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { need } from './_env.js';

const url = need('DATABASE_URL');
const dir = 'db/migrations';
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

const local = /@(localhost|127\.0\.0\.1)[:/]|host=\//.test(url);
if (local) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  for (const f of files) {
    await client.query(readFileSync(join(dir, f), 'utf8'));
    console.log(`applied ${f}`);
  }
  await client.end();
} else {
  // Neon over WebSockets supports multi-statement scripts (the HTTP driver does not).
  // Node 22+ ships a global WebSocket, which the driver picks up.
  const { Pool } = await import('@neondatabase/serverless');
  const pool = new Pool({ connectionString: url });
  for (const f of files) {
    await pool.query(readFileSync(join(dir, f), 'utf8'));
    console.log(`applied ${f}`);
  }
  await pool.end();
}
