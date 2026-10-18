import { HttpError } from './_lib/db.js';
import { handler, json, requireUser } from './_lib/http.js';
import { changesSince } from './_lib/repo.js';

export const GET = handler(async (req) => {
  const { db } = await requireUser(req);
  const since = new URL(req.url).searchParams.get('since') ?? '';
  if (Number.isNaN(Date.parse(since))) throw new HttpError(400, 'since must be an ISO timestamp.');
  return json(await changesSince(db, new Date(since).toISOString()));
});
