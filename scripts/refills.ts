// Seeds water refill points from OpenStreetMap via Overpass (TRD §8.3).
// Writes seed/refills.json; add --db to upsert into the database as well.
// OSM coverage inside the parks is patchy: long-press "Add refill here" in
// the app fills the gaps, and every point gets confirmed on the trip.
import './_env.js';
import { writeFileSync } from 'node:fs';
import { stableUuid } from '../src/shared/ids.js';
import { WDW_BBOX, parkForPoint } from '../src/shared/parks.js';
import type { RefillStation } from '../src/shared/types.js';

const [west, south, east, north] = WDW_BBOX;
const bbox = `${south},${west},${north},${east}`;
const query = `[out:json][timeout:60];
(
  node["amenity"="drinking_water"](${bbox});
  node["drinking_water"="yes"](${bbox});
);
out body;`;

interface OsmNode {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

const res = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'park-plate/0.1 (personal trip planner)' },
  body: `data=${encodeURIComponent(query)}`,
});
if (!res.ok) {
  console.error(`Overpass ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const nodes = ((await res.json()) as { elements: OsmNode[] }).elements;

const now = new Date().toISOString();
const refills: RefillStation[] = [];
for (const n of nodes) {
  const park_id = parkForPoint(n.lon, n.lat);
  if (!park_id) continue; // resorts, roads, etc.
  const t = n.tags ?? {};
  refills.push({
    id: stableUuid(`osm:${n.id}`),
    park_id,
    kind: t.bottle === 'yes' ? 'bottle_filler' : 'fountain',
    lng: n.lon,
    lat: n.lat,
    indoor: t.indoor === 'yes' ? true : t.indoor === 'no' ? false : null,
    description: t.description ?? t.note ?? t.name ?? null,
    osm_id: `node/${n.id}`,
    last_confirmed: null,
    updated_at: now,
  });
}

writeFileSync('seed/refills.json', `${JSON.stringify(refills, null, 2)}\n`);
const byPark = refills.reduce<Record<string, number>>((a, r) => ({ ...a, [r.park_id]: (a[r.park_id] ?? 0) + 1 }), {});
console.log(`${refills.length} refill points inside the parks`, byPark);

if (process.argv.includes('--db') && refills.length) {
  const { getDb } = await import('../api/_lib/db.js');
  const { insertRows } = await import('./_sql.js');
  const db = await getDb();
  await db.tx(insertRows('refill_stations',
    ['id', 'park_id', 'kind', 'lng', 'lat', 'indoor', 'description', 'osm_id', 'last_confirmed', 'updated_at'],
    refills as never,
    'on conflict (osm_id) do update set lng = excluded.lng, lat = excluded.lat, kind = excluded.kind',
    { kind: 'refill_kind', last_confirmed: 'date' }));
  console.log('Upserted into refill_stations.');
}
process.exit(0);
