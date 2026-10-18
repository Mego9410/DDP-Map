// Integration tests for the Vercel functions against a real Postgres.
// Run with a disposable database:
//   TEST_DATABASE_URL=postgresql://postgres@localhost:54329/parkplate_test npm test
// The suite resets that database, so never point it at Neon production.
import { readFileSync, readdirSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb, setDbForTests, type Db } from './_lib/db.js';
import { createToken } from './_lib/session.js';
import { POST as login } from './login.js';
import { GET as me } from './me.js';
import { GET as data } from './data.js';
import { GET as changes } from './changes.js';
import { POST as sync } from './sync.js';
import { GET as edits } from './edits.js';
import { POST as upload } from './media/index.js';
import { GET as media } from './media/[id].js';
import { GET as placesPhoto } from './places-photo.js';
import { normalizeSeed, type CoordFile, type SeedFile } from '../src/shared/normalize.js';
import { insertRows } from '../scripts/_sql.js';
import type { DataSnapshot } from '../src/shared/types.js';

const url = process.env.TEST_DATABASE_URL;
const ADMIN = 'oliver@example.com';
const MEMBER = 'sam@example.com';

function req(path: string, init: RequestInit & { as?: string } = {}): Request {
  const headers = new Headers(init.headers);
  headers.set('x-park-plate', '1');
  if (init.as) headers.set('cookie', `pp_session=${createToken(init.as, init.as === ADMIN ? 'admin' : 'member')}`);
  return new Request(`http://localhost${path}`, { ...init, headers });
}

const post = (path: string, body: unknown, as?: string) =>
  req(path, { method: 'POST', body: JSON.stringify(body), as, headers: { 'content-type': 'application/json' } });

describe.skipIf(!url)('API (Postgres)', () => {
  let db: Db;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret-123';
    process.env.FAMILY_PASSCODE = 'mickey';
    db = await getDb();
    setDbForTests(db);
    await db.query('drop schema public cascade');
    await db.query('create schema public');
    const { default: pg } = await import('pg');
    const c = new pg.Client({ connectionString: url });
    await c.connect();
    for (const f of readdirSync('db/migrations').filter((x) => x.endsWith('.sql')).sort()) {
      await c.query(readFileSync(`db/migrations/${f}`, 'utf8'));
    }
    await c.end();
    const seed = normalizeSeed(
      JSON.parse(readFileSync('seed/locations.json', 'utf8')) as SeedFile,
      JSON.parse(readFileSync('seed/coordinates.json', 'utf8')) as CoordFile,
    );
    await db.tx([
      ...insertRows('parks', ['id', 'name', 'short_name', 'center_lng', 'center_lat', 'default_zoom'], seed.parks as never, ''),
      ...insertRows('lands', ['id', 'park_id', 'name'], seed.lands as never, ''),
      ...insertRows('locations', ['id', 'park_id', 'land_id', 'area_label', 'name', 'credit', 'meals', 'lng', 'lat', 'menu_as_of', 'sources', 'theme_id', 'updated_at'],
        seed.locations as never, '', { credit: 'credit_type', meals: 'text[]', sources: 'text[]', menu_as_of: 'date' }),
      ...insertRows('menu_items', ['id', 'location_id', 'section', 'name', 'price_usd', 'qs_eligible', 'snack_eligible', 'seasonal', 'note', 'sort', 'updated_at'],
        seed.menu_items as never, '', { section: 'item_section', qs_eligible: 'tri', snack_eligible: 'tri' }),
      { text: "insert into family_members (email, role, name) values ($1, 'admin', 'Oliver'), ($2, 'member', 'Sam')", params: [ADMIN, MEMBER] },
    ]);
  });

  afterAll(() => setDbForTests(null));

  it('rejects a wrong passcode and an unknown email with the same inline message', async () => {
    const a = await login(post('/api/login', { email: ADMIN, passcode: 'nope' }));
    const b = await login(post('/api/login', { email: 'stranger@example.com', passcode: 'mickey' }));
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect((await a.json()).error).toBe((await b.json()).error);
  });

  it('signs in an allowlisted email and sets an HttpOnly cookie', async () => {
    const r = await login(post('/api/login', { email: ' Oliver@Example.com ', passcode: 'mickey' }));
    expect(r.status).toBe(200);
    expect(r.headers.get('set-cookie')).toMatch(/pp_session=.+HttpOnly/);
    expect((await r.json()).user).toMatchObject({ email: ADMIN, role: 'admin' });
  });

  it('requires a session for data', async () => {
    expect((await data(req('/api/data'))).status).toBe(401);
    expect((await me(req('/api/me', { as: 'removed@example.com' }))).status).toBe(403);
    const r = await data(req('/api/data', { as: 'removed@example.com' }));
    expect(r.status).toBe(403);
    expect((await r.json()).error).toMatch(/no longer on the family list/);
  });

  it('serves a snapshot shaped like the client types', async () => {
    const r = await data(req('/api/data', { as: MEMBER }));
    expect(r.status).toBe(200);
    expect(r.headers.get('x-robots-tag')).toMatch(/noindex/);
    const s = (await r.json()) as DataSnapshot;
    expect(s.locations).toHaveLength(66);
    expect(s.menu_items).toHaveLength(1030);
    const pecos = s.locations.find((l) => l.id === 'pecos-bill-tall-tale-inn-and-cafe')!;
    expect(pecos.menu_as_of).toBe('2026-10-16');
    expect(Array.isArray(pecos.meals)).toBe(true);
    const item = s.menu_items.find((i) => i.price_usd != null)!;
    expect(typeof item.price_usd).toBe('number');
    expect(item.updated_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    expect(Date.parse(s.generated_at)).not.toBeNaN();
  });

  it('syncs favourites across family members, last write wins', async () => {
    const cursor = ((await (await data(req('/api/data', { as: MEMBER }))).json()) as DataSnapshot).generated_at;
    const t1 = new Date(Date.now() - 2000).toISOString();
    const t0 = new Date(Date.now() - 4000).toISOString();
    const r1 = await sync(post('/api/sync', { ops: [{ op_id: 'a', kind: 'favourite', location_id: 'satu-li-canteen', starred: true, visited_on: null, updated_at: t1 }] }, ADMIN));
    expect((await r1.json()).results).toEqual([{ op_id: 'a', status: 'applied' }]);
    const r2 = await sync(post('/api/sync', { ops: [{ op_id: 'b', kind: 'favourite', location_id: 'satu-li-canteen', starred: false, visited_on: null, updated_at: t0 }] }, ADMIN));
    expect((await r2.json()).results[0].status).toBe('stale');

    const c = await (await changes(req(`/api/changes?since=${encodeURIComponent(cursor)}`, { as: MEMBER }))).json();
    expect(c.favourites).toEqual([expect.objectContaining({ user_email: ADMIN, location_id: 'satu-li-canteen', starred: true })]);
  });

  it('lets the admin edit a price, logs who did it, and blocks members', async () => {
    const s = (await (await data(req('/api/data', { as: ADMIN }))).json()) as DataSnapshot;
    const item = s.menu_items.find((i) => i.location_id === 'pecos-bill-tall-tale-inn-and-cafe' && i.section === 'entree')!;
    const op = (id: string) => ({ op_id: id, kind: 'item_upsert', updated_at: new Date().toISOString(), item: { ...item, updated_at: undefined, price_usd: 14.49 } });

    const denied = await (await sync(post('/api/sync', { ops: [op('m1')] }, MEMBER))).json();
    expect(denied.results[0]).toMatchObject({ status: 'rejected', error: 'Only the admin can edit data.' });

    const ok = await (await sync(post('/api/sync', { ops: [op('a1')] }, ADMIN))).json();
    expect(ok.results[0].status).toBe('applied');

    const after = (await (await data(req('/api/data', { as: MEMBER }))).json()) as DataSnapshot;
    expect(after.menu_items.find((i) => i.id === item.id)!.price_usd).toBe(14.49);

    const log = await (await edits(req('/api/edits', { as: ADMIN }))).json();
    expect(log.edits[0]).toMatchObject({ user_email: ADMIN, table_name: 'menu_items', row_id: item.id });
    expect(Number(log.edits[0].before.price_usd)).toBe(item.price_usd);
    expect(Number(log.edits[0].after.price_usd)).toBe(14.49);
    expect((await edits(req('/api/edits', { as: MEMBER }))).status).toBe(403);
  });

  it('moves a pin and rejects invalid patches', async () => {
    const ts = new Date().toISOString();
    const res = await (await sync(post('/api/sync', {
      ops: [
        { op_id: 'p1', kind: 'location', id: 'casey-s-corner', updated_at: ts, patch: { lat: 28.4177, lng: -81.5817, coord_source: 'manual' } },
        { op_id: 'p2', kind: 'location', id: 'casey-s-corner', updated_at: ts, patch: { lat: 51.5 } },
        { op_id: 'p3', kind: 'location', id: 'casey-s-corner', updated_at: ts, patch: { id: 'hijack' } },
      ],
    }, ADMIN))).json();
    expect(res.results.map((r: { status: string }) => r.status)).toEqual(['applied', 'rejected', 'rejected']);
    const rows = await db.query<{ lat: number; coord_source: string }>("select lat, coord_source from locations where id = 'casey-s-corner'");
    expect(rows[0]).toEqual({ lat: 28.4177, coord_source: 'manual' });
  });

  it('adds and deletes a refill point and reports the deletion in changes', async () => {
    const id = crypto.randomUUID();
    const cursor = new Date(Date.now() - 1000).toISOString();
    const add = { op_id: 'r1', kind: 'refill_upsert', updated_at: new Date().toISOString(), refill: { id, park_id: 'magic-kingdom', kind: 'bottle_filler', lng: -81.582, lat: 28.418, indoor: false, description: 'By the restrooms', osm_id: null, last_confirmed: '2026-10-18' } };
    expect((await (await sync(post('/api/sync', { ops: [add] }, ADMIN))).json()).results[0].status).toBe('applied');
    const del = { op_id: 'r2', kind: 'refill_delete', id, updated_at: new Date(Date.now() + 1000).toISOString() };
    expect((await (await sync(post('/api/sync', { ops: [del] }, ADMIN))).json()).results[0].status).toBe('applied');
    const c = await (await changes(req(`/api/changes?since=${encodeURIComponent(cursor)}`, { as: MEMBER }))).json();
    expect(c.deleted).toContainEqual({ table_name: 'refill_stations', row_id: id });
  });

  it('stores media privately and serves it only to family', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const up = await upload(req('/api/media', { method: 'POST', body: png, as: ADMIN, headers: { 'content-type': 'image/png' } }));
    expect(up.status).toBe(201);
    const { id, path } = await up.json();
    expect(path).toBe(`/api/media/${id}`);
    expect((await media(req(path))).status).toBe(401);
    const got = await media(req(path, { as: MEMBER }));
    expect(got.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await got.arrayBuffer()).equals(png)).toBe(true);
    const bad = await upload(req('/api/media', { method: 'POST', body: '<svg onload="x()"/>', as: ADMIN, headers: { 'content-type': 'image/svg+xml' } }));
    expect(bad.status).toBe(415);
    const member = await upload(req('/api/media', { method: 'POST', body: png, as: MEMBER, headers: { 'content-type': 'image/png' } }));
    expect(member.status).toBe(403);
  });

  it('saves a photo gallery with credits and rejects bad entries', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const { path } = await (await upload(req('/api/media', { method: 'POST', body: png, as: ADMIN, headers: { 'content-type': 'image/png' } }))).json();
    const photos = [{ path, attribution: 'Photo: Jane Doe, CC BY-SA 4.0, via Wikimedia Commons', license: 'CC BY-SA 4.0', source_url: 'https://commons.wikimedia.org/wiki/File:X.jpg' }];
    const ts = new Date().toISOString();
    const res = await (await sync(post('/api/sync', {
      ops: [
        { op_id: 'ph1', kind: 'location', id: 'pizzafari', updated_at: ts, patch: { photos, hero_path: path, hero_attribution: photos[0].attribution } },
        { op_id: 'ph2', kind: 'location', id: 'pizzafari', updated_at: ts, patch: { photos: [{ path: 'https://evil.example/x.jpg', attribution: null, license: null, source_url: null }] } },
      ],
    }, ADMIN))).json();
    expect(res.results.map((r: { status: string }) => r.status)).toEqual(['applied', 'rejected']);
    const s = (await (await data(req('/api/data', { as: MEMBER }))).json()) as DataSnapshot;
    const loc = s.locations.find((l) => l.id === 'pizzafari')!;
    expect(loc.photos).toEqual(photos);
    expect(loc.hero_path).toBe(path);
  });

  it('places-photo returns a gallery with attributions and never stores Google images', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';
    await db.query("update locations set google_place_id = 'ChIJtest' where id = 'casey-s-corner'");
    const calls: string[] = [];
    const fake = vi.fn(async (input: string | URL | Request) => {
      const u = String(input);
      calls.push(u);
      if (u.endsWith('/places/ChIJtest')) {
        return new Response(JSON.stringify({ photos: [
          { name: 'places/ChIJtest/photos/a', widthPx: 800, heightPx: 1200, authorAttributions: [{ displayName: 'Tall Pic', uri: 'https://maps.google.com/a' }] },
          { name: 'places/ChIJtest/photos/b', widthPx: 1600, heightPx: 900, authorAttributions: [{ displayName: 'Wide Pic' }] },
        ] }));
      }
      if (u.includes('/media?')) return new Response(JSON.stringify({ photoUri: `https://lh3.googleusercontent.com/${u.includes('/a/') ? 'a' : 'b'}` }));
      return new Response('nope', { status: 404 });
    });
    vi.stubGlobal('fetch', fake);
    try {
      const r = await placesPhoto(req('/api/places-photo?location_id=casey-s-corner', { as: MEMBER }));
      expect(r.status).toBe(200);
      const body = await r.json();
      expect(body.photos.map((p: { photoUri: string }) => p.photoUri)).toEqual(['https://lh3.googleusercontent.com/b', 'https://lh3.googleusercontent.com/a']);
      expect(body.photos[0].attributions).toEqual([{ name: 'Wide Pic', uri: null }]);
      expect(calls.every((c) => c.startsWith('https://places.googleapis.com/'))).toBe(true);
      const stored = await db.query<{ n: number }>("select count(*)::int as n from media where content_type <> 'image/png'");
      expect(stored[0].n).toBe(0);
      expect((await placesPhoto(req('/api/places-photo?location_id=pizzafari', { as: MEMBER }))).status).toBe(404);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('requires the app header on mutations', async () => {
    const r = await sync(new Request('http://localhost/api/sync', { method: 'POST', body: '{"ops":[]}' }));
    expect(r.status).toBe(400);
  });
});
