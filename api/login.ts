import { getDb, HttpError } from './_lib/db.js';
import { handler, json, readJson, requireAppHeader } from './_lib/http.js';
import { createToken, safeEqual, sessionCookie } from './_lib/session.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const POST = handler(async (req) => {
  requireAppHeader(req);
  const body = await readJson<{ email?: unknown; passcode?: unknown }>(req, 4096);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const passcode = typeof body.passcode === 'string' ? body.passcode : '';
  if (!email || !passcode) throw new HttpError(400, 'Enter your email and the family passcode.');

  const expected = process.env.FAMILY_PASSCODE;
  if (!expected) throw new HttpError(503, 'FAMILY_PASSCODE is not configured on the server.');

  const db = await getDb();
  const rows = await db.query<{ email: string; name: string | null; role: 'admin' | 'member' }>(
    'select email, name, role from family_members where email = $1',
    [email],
  );
  const ok = safeEqual(passcode, expected) && rows.length === 1;
  if (!ok) {
    await sleep(600); // slow down guessing
    throw new HttpError(401, "That email and passcode don't match the family list.");
  }
  const user = rows[0];
  return json({ user }, { headers: { 'Set-Cookie': sessionCookie(createToken(user.email, user.role)) } });
});
