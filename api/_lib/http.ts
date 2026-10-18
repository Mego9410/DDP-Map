import type { SessionUser } from '../../src/shared/types.js';
import { getDb, HttpError, type Db } from './db.js';
import { readCookie, verifyToken } from './session.js';

const BASE_HEADERS = {
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'no-store',
};

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  for (const [k, v] of Object.entries(BASE_HEADERS)) if (!headers.has(k)) headers.set(k, v);
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return json({ error: e.message }, { status: e.status });
  console.error(e);
  return json({ error: 'Something went wrong on the server.' }, { status: 500 });
}

/** Wraps a handler so thrown HttpErrors become JSON responses. */
export function handler(fn: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      return await fn(req);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

/** Mutations must be same-origin JSON-ish requests carrying our header (CSRF guard). */
export function requireAppHeader(req: Request): void {
  if (req.headers.get('x-park-plate') !== '1') throw new HttpError(400, 'Missing app header.');
}

/**
 * Resolves the signed-in family member. The allowlist is re-checked on every
 * request, so removing someone from family_members revokes access at once.
 */
export async function requireUser(req: Request, db?: Db): Promise<{ user: SessionUser; db: Db }> {
  const token = readCookie(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload) throw new HttpError(401, 'Please sign in.');
  const d = db ?? (await getDb());
  const rows = await d.query<{ email: string; name: string | null; role: 'admin' | 'member' }>(
    'select email, name, role from family_members where email = $1',
    [payload.email],
  );
  if (!rows.length) throw new HttpError(403, 'This email is no longer on the family list.');
  return { user: rows[0], db: d };
}

export async function requireAdmin(req: Request): Promise<{ user: SessionUser; db: Db }> {
  const r = await requireUser(req);
  if (r.user.role !== 'admin') throw new HttpError(403, 'Only the admin can edit data.');
  return r;
}

export async function readJson<T>(req: Request, maxBytes = 256 * 1024): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Request too large.');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'Request body must be JSON.');
  }
}
