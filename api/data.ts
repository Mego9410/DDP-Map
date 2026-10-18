import { handler, json, requireUser } from './_lib/http.js';
import { snapshot } from './_lib/repo.js';

export const GET = handler(async (req) => {
  const { db } = await requireUser(req);
  return json(await snapshot(db));
});
