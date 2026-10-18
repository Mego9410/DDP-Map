import { handler, json, requireAdmin } from './_lib/http.js';
import { recentEdits } from './_lib/repo.js';

export const GET = handler(async (req) => {
  const { db } = await requireAdmin(req);
  return json({ edits: await recentEdits(db) });
});
