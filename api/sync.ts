import { HttpError } from './_lib/db.js';
import { handler, json, readJson, requireAppHeader, requireUser } from './_lib/http.js';
import { applyOps } from './_lib/repo.js';

const MAX_OPS = 200;

export const POST = handler(async (req) => {
  requireAppHeader(req);
  const { user, db } = await requireUser(req);
  const body = await readJson<{ ops?: unknown }>(req, 1024 * 1024);
  if (!Array.isArray(body.ops)) throw new HttpError(400, 'Body must be { ops: [...] }.');
  if (body.ops.length > MAX_OPS) throw new HttpError(413, `Send at most ${MAX_OPS} changes at a time.`);
  return json({ results: await applyOps(db, body.ops, user) });
});
