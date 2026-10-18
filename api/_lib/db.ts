// Thin database adapter: Neon's HTTP driver in production, node-postgres
// for a local Postgres (DATABASE_URL pointing at localhost) in dev and tests.

import { neon } from '@neondatabase/serverless';

export interface Stmt {
  text: string;
  params?: unknown[];
}

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Runs statements in one transaction and returns each statement's rows. */
  tx(stmts: Stmt[]): Promise<Record<string, unknown>[][]>;
}

function isLocal(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '';
  } catch {
    return false;
  }
}

function neonDb(url: string): Db {
  const sql = neon(url);
  return {
    async query(text, params = []) {
      return (await sql.query(text, params)) as never[];
    },
    async tx(stmts) {
      return (await sql.transaction(stmts.map((s) => sql.query(s.text, s.params ?? [])))) as Record<string, unknown>[][];
    },
  };
}

async function pgDb(url: string): Promise<Db> {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url, max: 4 });
  return {
    async query(text, params = []) {
      return (await pool.query(text, params)).rows;
    },
    async tx(stmts) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const out: Record<string, unknown>[][] = [];
        for (const s of stmts) out.push((await client.query(s.text, s.params ?? [])).rows);
        await client.query('commit');
        return out;
      } catch (e) {
        await client.query('rollback').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

let cached: Promise<Db> | null = null;
let override: Db | null = null;

export function getDb(): Promise<Db> {
  if (override) return Promise.resolve(override);
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new HttpError(503, 'The database is not configured (DATABASE_URL is missing).');
    cached = isLocal(url) ? pgDb(url) : Promise.resolve(neonDb(url));
  }
  return cached;
}

/** Tests inject a database here. */
export function setDbForTests(db: Db | null): void {
  override = db;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
