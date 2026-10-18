import { handler, json, requireUser } from './_lib/http.js';

export const GET = handler(async (req) => {
  const { user } = await requireUser(req);
  return json({ user });
});
