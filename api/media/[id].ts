import { HttpError } from '../_lib/db.js';
import { errorResponse, requireUser } from '../_lib/http.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request): Promise<Response> {
  try {
    const { db } = await requireUser(req);
    const id = new URL(req.url).pathname.split('/').pop() ?? '';
    if (!UUID.test(id)) throw new HttpError(404, 'Not found.');
    const rows = await db.query<{ content_type: string; bytes: Buffer | Uint8Array | string }>(
      'select content_type, bytes from media where id = $1',
      [id],
    );
    if (!rows.length) throw new HttpError(404, 'Not found.');
    const raw = rows[0].bytes;
    // node-postgres returns a Buffer; Neon's HTTP driver returns bytea as a "\x..." hex string.
    const bytes = typeof raw === 'string' ? Buffer.from(raw.replace(/^\\x/, ''), 'hex') : Buffer.from(raw);
    return new Response(bytes, {
      headers: {
        'Content-Type': rows[0].content_type,
        // Media ids are immutable; a replaced photo gets a new id.
        'Cache-Control': 'private, max-age=2592000, immutable',
        'X-Robots-Tag': 'noindex, nofollow',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
