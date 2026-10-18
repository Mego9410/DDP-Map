// Loads seed/*.json into Postgres (TRD §8.1). Themes stay in code
// (src/shared/themes.ts); the themes table only holds deliberate overrides.
//
//   npm run db:seed            insert anything missing; keeps in-app edits
//   npm run db:seed -- --force overwrite locations and menu items from the seed
//
// FAMILY_MEMBERS (in .env.local) adds the allowlist, e.g.
//   FAMILY_MEMBERS="oliver@example.com:admin:Oliver,partner@example.com:member:Sam"
import './_env.js';
import { existsSync, readFileSync } from 'node:fs';
import { getDb } from '../api/_lib/db.js';
import { normalizeSeed, type CoordFile, type PhotoManifest, type SeedFile } from '../src/shared/normalize.js';
import type { RefillStation } from '../src/shared/types.js';
import { excludedSet, insertRows } from './_sql.js';
import { need } from './_env.js';

need('DATABASE_URL');
const force = process.argv.includes('--force');
const read = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;

const data = normalizeSeed(
  read<SeedFile>('seed/locations.json'),
  read<CoordFile>('seed/coordinates.json'),
  read<RefillStation[]>('seed/refills.json'),
  existsSync('seed/photos.json') ? read<PhotoManifest>('seed/photos.json') : {},
);

const db = await getDb();

const LOC_COLS = [
  'id', 'park_id', 'land_id', 'area_label', 'name', 'short_name', 'credit', 'credit_note', 'meals', 'hours',
  'mobile_order', 'seasonal', 'lng', 'lat', 'coord_source', 'google_place_id', 'theme_id', 'menu_as_of',
  'sources', 'notes', 'hero_path', 'hero_attribution', 'photos', 'updated_at',
];
const ITEM_COLS = ['id', 'location_id', 'section', 'name', 'price_usd', 'qs_eligible', 'snack_eligible', 'seasonal', 'note', 'sort', 'updated_at'];
const REFILL_COLS = ['id', 'park_id', 'kind', 'lng', 'lat', 'indoor', 'description', 'osm_id', 'last_confirmed', 'updated_at'];

const family = (process.env.FAMILY_MEMBERS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((entry) => {
    const [email, role = 'member', ...name] = entry.split(':');
    return { email: email.trim().toLowerCase(), role: role === 'admin' ? 'admin' : 'member', name: name.join(':') || null };
  });

const stmts = [
  ...insertRows('parks', ['id', 'name', 'short_name', 'center_lng', 'center_lat', 'default_zoom'], data.parks as never,
    'on conflict (id) do update set name = excluded.name, short_name = excluded.short_name, center_lng = excluded.center_lng, center_lat = excluded.center_lat, default_zoom = excluded.default_zoom'),
  ...insertRows('lands', ['id', 'park_id', 'name'], data.lands as never, 'on conflict (id) do update set name = excluded.name'),
  ...insertRows('locations', LOC_COLS, data.locations.map((l) => ({ ...l, photos: JSON.stringify(l.photos) })) as never,
    force ? `on conflict (id) do update set ${excludedSet(LOC_COLS, ['id'])}` : 'on conflict (id) do nothing',
    { credit: 'credit_type', menu_as_of: 'date', meals: 'text[]', sources: 'text[]', photos: 'jsonb' }),
  ...insertRows('menu_items', ITEM_COLS, data.menu_items as never,
    force ? `on conflict (id) do update set ${excludedSet(ITEM_COLS, ['id', 'location_id'])}` : 'on conflict (id) do nothing',
    { section: 'item_section', qs_eligible: 'tri', snack_eligible: 'tri' }),
  ...insertRows('refill_stations', REFILL_COLS, data.refill_stations as never, 'on conflict (id) do nothing',
    { kind: 'refill_kind', last_confirmed: 'date' }),
  ...insertRows('family_members', ['email', 'role', 'name'], family,
    'on conflict (email) do update set role = excluded.role, name = coalesce(excluded.name, family_members.name)'),
];

await db.tx(stmts);
const [counts] = await db.tx([{
  text: `select (select count(*) from locations)::int as locations, (select count(*) from menu_items)::int as items,
          (select count(*) from refill_stations)::int as refills, (select count(*) from family_members)::int as family`,
}]);
console.log(`Seeded${force ? ' (forced)' : ''}:`, counts[0]);
if (!counts[0].family) console.log('No FAMILY_MEMBERS set, so nobody can sign in yet. See the script header.');
process.exit(0);
