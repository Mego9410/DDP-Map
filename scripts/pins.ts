// Real pin positions from OpenStreetMap, no API key needed (replaces the
// Google Places geocode step). Matches each restaurant to the OSM feature
// with its name inside the right park.
//
//   npm run pins            update seed/coordinates.json (source "osm")
//   npm run pins -- --db    also update the database (manually moved pins are kept)
//
// Restaurants OSM doesn't have keep their estimated pin; fix those in the
// app with Move pin.
import './_env.js';
import { readFileSync, writeFileSync } from 'node:fs';
import type { CoordFile, SeedFile } from '../src/shared/normalize.js';
import { PARK_ID_BY_NAME, WDW_BBOX } from '../src/shared/parks.js';
import { matchPins, overpassQuery, type OsmElement } from './_osm.js';

const OVERPASS = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
const seed = JSON.parse(readFileSync('seed/locations.json', 'utf8')) as SeedFile;
const coords = JSON.parse(readFileSync('seed/coordinates.json', 'utf8')) as CoordFile;

let res: Response;
try {
  res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'park-plate/0.1 (personal trip planner)' },
    body: `data=${encodeURIComponent(overpassQuery(WDW_BBOX))}`,
  });
} catch (e) {
  console.error(`Can't reach ${new URL(OVERPASS).host}: ${(e as Error).cause ?? (e as Error).message}`);
  console.error('Check your connection, or set OVERPASS_URL to another Overpass server.');
  process.exit(1);
}
if (!res.ok) {
  console.error(`Overpass ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
const elements = ((await res.json()) as { elements: OsmElement[] }).elements;
console.log(`${elements.length} food and drink features from OpenStreetMap`);

const targets = seed.locations
  .filter((l) => {
    const c = coords[l.id];
    return !(typeof c === 'object' && c.source === 'manual');
  })
  .map((l) => {
    const c = coords[l.id];
    return {
      id: l.id,
      park_id: PARK_ID_BY_NAME[l.park],
      names: [...new Set([l.name, l.short_name].filter(Boolean))],
      lat: typeof c === 'object' ? c.lat : null,
      lng: typeof c === 'object' ? c.lng : null,
    };
  });

const matches = matchPins(targets, elements);
const byId = new Map(matches.map((m) => [m.id, m]));
for (const l of seed.locations) {
  const m = byId.get(l.id);
  if (m) {
    coords[l.id] = { lat: m.lat, lng: m.lng, source: 'osm', osm_id: m.osm_id };
    console.log(`  ✓ ${l.name} -> "${m.osm_name}" (${m.osm_id}, ${m.score})`);
  } else if (targets.some((t) => t.id === l.id)) {
    console.log(`  · ${l.name}: not found in OSM, keeping the estimate`);
  }
}
writeFileSync('seed/coordinates.json', `${JSON.stringify(coords, null, 2)}\n`);
console.log(`\n${matches.length} of ${targets.length} pins placed from OpenStreetMap. Written to seed/coordinates.json.`);

if (process.argv.includes('--db') && matches.length) {
  const { getDb } = await import('../api/_lib/db.js');
  const db = await getDb();
  await db.tx(matches.map((m) => ({
    text: `update locations set lat = $2, lng = $3, coord_source = 'osm', updated_at = now()
           where id = $1 and coalesce(coord_source, 'approx') <> 'manual'`,
    params: [m.id, m.lat, m.lng],
  })));
  console.log('Database updated (manually moved pins left alone).');
}
process.exit(0);
