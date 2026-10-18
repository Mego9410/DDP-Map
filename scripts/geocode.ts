// One-off coordinates pass (TRD §8.2). For every location still marked
// "approx", asks Google Places (New) Text Search for "<name> <park> Walt
// Disney World", biased to the WDW box, and writes the result to
// seed/coordinates.json (source "places", plus the place id for photos).
//
//   npm run geocode               all approx locations
//   npm run geocode -- --all      re-check every location
//   npm run geocode -- --db       also update the database (keeps manual pins)
//
// Then fix any counter that lands on the wrong building with Move pin.
import './_env.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { need } from './_env.js';
import { WDW_BBOX, parkForPoint, PARK_ID_BY_NAME } from '../src/shared/parks.js';
import type { CoordFile, SeedFile } from '../src/shared/normalize.js';

const key = need('GOOGLE_PLACES_API_KEY');
const all = process.argv.includes('--all');
const toDb = process.argv.includes('--db');

const seed = JSON.parse(readFileSync('seed/locations.json', 'utf8')) as SeedFile;
const coords = JSON.parse(readFileSync('seed/coordinates.json', 'utf8')) as CoordFile;

interface Place {
  id: string;
  displayName?: { text: string };
  location?: { latitude: number; longitude: number };
}

async function search(text: string): Promise<Place | null> {
  const [west, south, east, north] = WDW_BBOX;
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.location',
    },
    body: JSON.stringify({
      textQuery: text,
      pageSize: 1,
      locationRestriction: { rectangle: { low: { latitude: south, longitude: west }, high: { latitude: north, longitude: east } } },
    }),
  });
  if (!res.ok) throw new Error(`Places ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { places?: Place[] }).places?.[0] ?? null;
}

const updated: { id: string; lat: number; lng: number; place_id: string }[] = [];
for (const loc of seed.locations) {
  const cur = coords[loc.id];
  if (!all && typeof cur === 'object' && cur.source !== 'approx') continue;
  const place = await search(`${loc.name} ${loc.park} Walt Disney World`);
  if (!place?.location) {
    console.warn(`  ? ${loc.name}: no result, keeping current pin`);
    continue;
  }
  const { latitude: lat, longitude: lng } = place.location;
  const park = parkForPoint(lng, lat);
  if (park !== PARK_ID_BY_NAME[loc.park]) {
    console.warn(`  ! ${loc.name}: Google says "${place.displayName?.text}" outside ${loc.park}; skipped`);
    continue;
  }
  coords[loc.id] = { lat, lng, source: 'places', place_id: place.id };
  updated.push({ id: loc.id, lat, lng, place_id: place.id });
  console.log(`  ✓ ${loc.name} -> ${lat.toFixed(5)}, ${lng.toFixed(5)} (${place.displayName?.text})`);
}

writeFileSync('seed/coordinates.json', `${JSON.stringify(coords, null, 2)}\n`);
console.log(`Updated ${updated.length} pins in seed/coordinates.json`);

if (toDb && updated.length) {
  need('DATABASE_URL');
  const { getDb } = await import('../api/_lib/db.js');
  const db = await getDb();
  await db.tx(updated.map((u) => ({
    text: `update locations set lat = $2, lng = $3, google_place_id = $4, coord_source = 'places', updated_at = now()
           where id = $1 and coalesce(coord_source, 'approx') <> 'manual'`,
    params: [u.id, u.lat, u.lng, u.place_id],
  })));
  console.log('Database updated (manual pins left alone).');
}
process.exit(0);
