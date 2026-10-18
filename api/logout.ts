import { handler, json, requireAppHeader } from './_lib/http.js';
import { clearCookie } from './_lib/session.js';

export const POST = handler(async (req) => {
  requireAppHeader(req);
  return json({ ok: true }, { headers: { 'Set-Cookie': clearCookie() } });
});
