import { HttpError } from '../_lib/db.js';
import { handler, json, requireAdmin, requireAppHeader } from '../_lib/http.js';

// Vercel caps request bodies at 4.5 MB; the client resizes to 1600px WebP first.
const MAX_BYTES = 3 * 1024 * 1024;
const TYPES = new Set(['image/webp', 'image/png', 'image/jpeg', 'image/svg+xml']);

export const POST = handler(async (req) => {
  requireAppHeader(req);
  const { user, db } = await requireAdmin(req);
  const type = (req.headers.get('content-type') ?? '').split(';')[0].trim();
  if (!TYPES.has(type)) throw new HttpError(415, 'Upload a WebP, PNG, JPEG or SVG image.');
  const bytes = Buffer.from(await req.arrayBuffer());
  if (!bytes.length) throw new HttpError(400, 'The image is empty.');
  if (bytes.length > MAX_BYTES) throw new HttpError(413, 'Images must be under 3 MB.');
  if (type === 'image/svg+xml' && /<script|\son\w+=|javascript:/i.test(bytes.toString('utf8'))) {
    throw new HttpError(415, 'SVG logos cannot contain scripts.');
  }
  const rows = await db.query<{ id: string }>(
    'insert into media (content_type, bytes, uploaded_by) values ($1, $2, $3) returning id::text as id',
    // Hex bytea literal works identically with Neon's HTTP driver and node-postgres.
    [type, `\\x${bytes.toString('hex')}`, user.email],
  );
  return json({ id: rows[0].id, path: `/api/media/${rows[0].id}` }, { status: 201 });
});
