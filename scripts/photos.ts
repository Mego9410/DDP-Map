// Real photos for every restaurant from Wikimedia Commons: freely licensed,
// so they may be stored (privately, in Postgres) and shown offline with a
// credit line. Google Places photos are a separate, live-only source: link
// places with `npm run geocode -- --db` and the app shows them online.
//
//   npm run photos                    search Commons, write seed/photos.json for review
//   (open seed/photos.json, delete any wrong matches)
//   npm run photos -- --upload        download what's listed and attach it in the database
//
// Options: --only=id1,id2   --per-place=3   --min-score=0.67
// Images never go in the repo: seed/photos.json holds links and credits only.
import './_env.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { need } from './_env.js';
import { pickCandidates, type Candidate, type CommonsPage } from './_commons.js';
import type { SeedFile } from '../src/shared/normalize.js';
import type { LocationPhoto } from '../src/shared/types.js';

const MANIFEST = 'seed/photos.json';
const UA = 'ParkPlate/0.1 (private family trip planner; https://github.com/Mego9410/DDP-Map)';
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const upload = process.argv.includes('--upload');
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
  const res = await fetch(u, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Commons ${res.status}`);
  return ((await res.json()) as { query?: { pages?: CommonsPage[] } }).query?.pages ?? [];
}

const targets = seed.locations.filter((l) => !only || only.includes(l.id));

if (!upload) {
  for (const loc of targets) {
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
  }
  save();
  const n = Object.values(manifest).flat().filter((e) => !e.media_path).length;
  console.log(`\n${n} candidate photos written to ${MANIFEST}. Check them, delete wrong ones, then run with --upload.`);
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
    const res = await fetch(e.image_url, { headers: { 'User-Agent': UA } });
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
