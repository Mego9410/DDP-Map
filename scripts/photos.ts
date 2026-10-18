// Real photos for every restaurant from Wikimedia Commons: freely licensed,
// so they may be stored (privately, in Postgres) and shown offline with a
// credit line. Google Places photos are a separate, live-only source: link
// places with `npm run geocode -- --db` and the app shows them online.
//
//   npm run photos                    search Commons, write seed/photos.json for review
//   (open seed/photos.json, delete any wrong matches)
//   npm run photos -- --upload        download what's listed and attach it in the database
//   npm run photos -- --to-repo       or: save them under public/photos/ so they ship with
//                                     the app (no database needed); then commit them
//
// Options: --only=id1,id2   --per-place=3   --min-score=0.67   --fresh (search places already searched)
// PHOTOS_MANIFEST=path writes the review file elsewhere (default seed/photos.json).
// With --upload, images stay out of the repo (seed/photos.json holds links and
// credits only). --to-repo is for freely licensed images only, which is all
// this script ever selects; their credit lines travel with them.
import './_env.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { need } from './_env.js';
import { pickCandidates, type Candidate, type CommonsPage } from './_commons.js';
import type { SeedFile } from '../src/shared/normalize.js';
import type { LocationPhoto } from '../src/shared/types.js';

const MANIFEST = process.env.PHOTOS_MANIFEST ?? 'seed/photos.json';
const fresh = process.argv.includes('--fresh');
const UA = 'ParkPlate/0.1 (private family trip planner; https://github.com/Mego9410/DDP-Map)';
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const toRepo = process.argv.includes('--to-repo');
const upload = process.argv.includes('--upload') || toRepo;
const only = arg('only')?.split(',');
const perPlace = Number(arg('per-place') ?? 3);
const minScore = Number(arg('min-score') ?? 0.67);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Entry = Candidate & { media_path?: string };
type Manifest = Record<string, Entry[]>;

const seed = JSON.parse(readFileSync('seed/locations.json', 'utf8')) as SeedFile;
const manifest: Manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const save = () => writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

async function commonsSearch(q: string): Promise<CommonsPage[]> {
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  for (const [k, v] of Object.entries({
    action: 'query', format: 'json', formatversion: '2', generator: 'search', gsrnamespace: '6', gsrlimit: '25',
    gsrsearch: q, prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1280',
  })) u.searchParams.set(k, v);
  return ((await politeFetch(u)).json() as Promise<{ query?: { pages?: CommonsPage[] } }>).then((d) => d.query?.pages ?? []);
}

/** Wikimedia rate-limits shared addresses: back off on 429/5xx and retry. */
async function politeFetch(u: string | URL, tries = 6): Promise<Response> {
  for (let i = 0; ; i++) {
    const res = await fetch(u, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
    if (res.ok) return res;
    if (i >= tries || !(res.status === 429 || res.status >= 500)) throw new Error(`${new URL(String(u)).host} ${res.status}`);
    const wait = Number(res.headers.get('retry-after')) || Math.min(60, 3 * 2 ** i);
    console.warn(`  (rate limited, waiting ${wait}s)`);
    await sleep(wait * 1000);
  }
}

const targets = seed.locations.filter((l) => !only || only.includes(l.id));

if (!upload) {
  for (const loc of targets) {
    if (!fresh && loc.id in manifest) continue; // searched in an earlier run
    const names = [...new Set([loc.name, loc.short_name].filter(Boolean))];
    const pages = new Map<string, CommonsPage>();
    for (const q of [`"${loc.name}" Disney`, `${loc.short_name || loc.name} ${loc.park} Walt Disney World`]) {
      for (const p of await commonsSearch(q)) pages.set(p.title, p);
      await sleep(250);
    }
    const picks = pickCandidates(names, [...pages.values()], minScore).slice(0, perPlace);
    const kept = (manifest[loc.id] ?? []).filter((e) => e.media_path); // never forget uploaded ones
    manifest[loc.id] = [...kept, ...picks.filter((p) => !kept.some((k) => k.source_url === p.source_url))];
    console.log(`${picks.length ? '✓' : '·'} ${loc.name}: ${picks.map((p) => `${p.title} (${p.score})`).join(' | ') || 'no freely licensed match'}`);
    save(); // progress survives an interrupted run
  }
  save();
  const n = Object.values(manifest).flat().filter((e) => !e.media_path).length;
  console.log(`\n${n} candidate photos written to ${MANIFEST}. Check them, delete wrong ones, then run with --upload.`);
  process.exit(0);
}

if (toRepo) {
  mkdirSync('public/photos', { recursive: true });
  let saved = 0;
  for (const loc of targets) {
    const entries = manifest[loc.id] ?? [];
    let n = entries.filter((e) => e.media_path?.startsWith('/photos/')).length;
    for (const e of entries) {
      if (e.media_path) continue;
      const res = await politeFetch(e.image_url).catch(() => new Response(null, { status: 599 }));
      const type = (res.headers.get('content-type') ?? '').split(';')[0];
      const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : type === 'image/jpeg' ? 'jpg' : null;
      if (!res.ok || !ext) {
        console.warn(`  ! ${loc.name}: could not download ${e.title} (${res.status} ${type})`);
        continue;
      }
      const file = `${loc.id}-${++n}.${ext}`;
      writeFileSync(`public/photos/${file}`, Buffer.from(await res.arrayBuffer()));
      e.media_path = `/photos/${file}`;
      saved++;
      save();
      await sleep(400);
    }
    if (entries.some((e) => e.media_path)) console.log(`✓ ${loc.name}: ${entries.filter((e) => e.media_path).length} photo(s)`);
  }
  console.log(`\nSaved ${saved} photos to public/photos/. Commit them with seed/photos.json; db:seed and local mode pick them up.`);
  process.exit(0);
}

// --upload
need('DATABASE_URL');
const { getDb } = await import('../api/_lib/db.js');
const db = await getDb();
let added = 0;
for (const loc of targets) {
  const entries = manifest[loc.id] ?? [];
  for (const e of entries) {
    if (e.media_path) continue;
    const res = await politeFetch(e.image_url).catch(() => new Response(null, { status: 599 }));
    const type = (res.headers.get('content-type') ?? '').split(';')[0];
    if (!res.ok || !/^image\/(jpeg|png|webp)$/.test(type)) {
      console.warn(`  ! ${loc.name}: could not download ${e.title} (${res.status} ${type})`);
      continue;
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    const [row] = await db.query<{ id: string }>(
      'insert into media (content_type, bytes) values ($1, $2) returning id::text as id',
      [type, `\\x${bytes.toString('hex')}`],
    );
    e.media_path = `/api/media/${row.id}`;
    added++;
    save();
    await sleep(250);
  }
  const photos: LocationPhoto[] = entries
    .filter((e) => e.media_path)
    .map((e) => ({ path: e.media_path!, attribution: e.attribution, license: e.license, source_url: e.source_url }));
  if (!photos.length) continue;
  // Keep any photos already on the place (e.g. trip shots); add these after them.
  await db.query(
    `update locations set
       photos = (select coalesce(jsonb_agg(p), '[]'::jsonb) from (
                   select distinct on (p->>'path') p from jsonb_array_elements(photos || $2::jsonb) p) x),
       hero_path = coalesce(hero_path, $3),
       hero_attribution = case when hero_path is null then $4 else hero_attribution end,
       updated_at = now()
     where id = $1`,
    [loc.id, JSON.stringify(photos), photos[0].path, photos[0].attribution],
  );
  console.log(`✓ ${loc.name}: ${photos.length} photo(s)`);
}
console.log(`\nUploaded ${added} new photos.`);
process.exit(0);
