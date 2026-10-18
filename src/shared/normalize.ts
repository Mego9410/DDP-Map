// Turns the hand-gathered seed files into database-shaped rows.
// Used by the client in local-only mode, by scripts/seed.ts and by tests.

import { PARKS, PARK_ID_BY_NAME } from './parks.js';
import { stableUuid, slugify } from './ids.js';
import { defaultThemeId } from './themes.js';
import type {
  CoordSource, ItemSection, Land, Location, Meal, MenuItem, Park, RefillStation, Tri,
} from './types.js';

export interface SeedItem {
  item: string;
  price: number | null;
  note?: string;
  snackCredit?: boolean | null;
}

export interface SeedLocation {
  id: string;
  name: string;
  short_name: string;
  park: string;
  area: string;
  credit: 'quick_service' | 'snack' | 'none';
  meals: string[];
  lat: number | null;
  lng: number | null;
  entrees: SeedItem[];
  kids: SeedItem[];
  snacks: SeedItem[];
  notes: string;
  sources: string[];
  menu_as_of: string;
}

export interface SeedFile {
  generated: string;
  count: number;
  locations: SeedLocation[];
}

/** seed/photos.json: per location, the chosen photos and where each was stored. */
export type PhotoManifest = Record<string, { attribution: string; license: string; source_url: string; image_url?: string; media_path?: string }[]>;

/** Commons thumbnails come from thumb.wikimedia.org; upload.wikimedia.org serves the same paths. */
export function commonsImageUrl(url: string): string {
  return url.replace(/^https:\/\/thumb\.wikimedia\.org\//, 'https://upload.wikimedia.org/').replace(/\?.*$/, '');
}

export type CoordFile = Record<string, { lat: number; lng: number; source: CoordSource; place_id?: string; osm_id?: string } | string>;

export interface NormalizedSeed {
  parks: Park[];
  lands: Land[];
  locations: Location[];
  menu_items: MenuItem[];
  refill_stations: RefillStation[];
}

/** Locations whose credit type the sources disagree on (PRD §6). */
export const CONFLICTING_CREDIT: Record<string, string> = {
  'the-trolley-car-cafe-starbucks': 'Sources disagree (snack vs 1 QS credit). Confirm at the counter.',
  'amorette-s-patisserie': 'Sources disagree (snack vs 1 QS credit). Confirm at the counter.',
  'yak-yeti-local-food-cafes': 'Landry’s-operated; plan participation not confirmed for the counter. Confirm at the counter.',
};

/** Hours pulled out of the seed notes by hand. Everything else: check My Disney Experience. */
const HOURS: Record<string, string> = {
  'abc-commissary': '10:30am – 4:30pm (lunch only)',
  'dockside-diner': '10:30am – park close',
  'rosie-s-all-american-cafe': '10:30am – park close',
  'catalina-eddie-s': '10:30am – park close',
  'fairfax-fare': 'Breakfast to 11am · Lunch 11am–3pm · Dinner 3pm–close',
  'harambe-market': 'About 10:30am – 4:30pm (can close 3:15pm)',
  'chicken-guy': 'Breakfast 9–11am · 11am – 11pm',
  yesake: '11am – 11pm',
  'amorette-s-patisserie': '11am – 11pm',
  'the-daily-poutine': '11am – 11:30pm',
  'the-trolley-car-cafe-starbucks': 'Park open – close',
  'liberty-square-market': 'Hot items after 11am',
  'gideon-s-bakehouse': 'Hot Cookie Hour 2–3pm and 7–8pm',
};

const MOBILE_ORDER: Record<string, boolean> = {
  'dockside-diner': false,
};

const SEASONAL_LOCATIONS = new Set(['tortuga-tavern', 'dockside-diner']);

const DRINK_WORDS =
  /\b(latte|coffee|cold brew|frappuccino|macchiato|mocha|americano|espresso|cappuccino|chai|tea|lemonade|limeade|slush|slushy|juice|cocoa|hot chocolate|refresher|smoothie|soda|boba|milk ?shake|shake|float|water|fountain)\b/i;

function isDrink(name: string): boolean {
  return DRINK_WORDS.test(name) && !/\b(cake|cookie|cupcake|brownie|tart|pie|bread|cheesecake|waffle)\b/i.test(name);
}

function triFrom(v: boolean | null | undefined): Tri {
  if (v === true) return 'yes';
  if (v === false) return 'no';
  return 'unknown';
}

function cleanNote(note: string | undefined): string | null {
  const n = (note ?? '').trim();
  return n.length ? n : null;
}

function isSeasonalNote(note: string | null): boolean {
  return !!note && /(seasonal|halloween|holiday|limited[- ]time|festival)/i.test(note);
}

const QS_UNCONFIRMED = /(eligibility not confirmed|party size)/i;

export function normalizeSeed(seed: SeedFile, coords: CoordFile, refills: RefillStation[] = [], photoManifest: PhotoManifest = {}): NormalizedSeed {
  const stamp = `${seed.generated}T00:00:00.000Z`;
  const lands = new Map<string, Land>();
  const locations: Location[] = [];
  const menu_items: MenuItem[] = [];

  for (const s of seed.locations) {
    const park_id = PARK_ID_BY_NAME[s.park];
    if (!park_id) throw new Error(`Unknown park "${s.park}" for ${s.id}`);
    const land_id = `${park_id}--${slugify(s.area)}`;
    if (!lands.has(land_id)) lands.set(land_id, { id: land_id, park_id, name: s.area });

    const c = coords[s.id];
    const coord = typeof c === 'object' ? c : null;
    // Photos shipped with the app (/photos/...) or, until downloaded, loaded
    // straight from Commons. Database uploads are attached by
    // scripts/photos.ts --upload instead, so they're skipped here.
    const photos = (photoManifest[s.id] ?? [])
      .map((p) => ({ ...p, path: p.media_path ?? (p.image_url ? commonsImageUrl(p.image_url) : null) }))
      .filter((p): p is typeof p & { path: string } => !!p.path && !p.path.startsWith('/api/media/'))
      .map((p) => ({ path: p.path, attribution: p.attribution, license: p.license, source_url: p.source_url }));

    locations.push({
      id: s.id,
      park_id,
      land_id,
      area_label: s.area,
      name: s.name,
      short_name: s.short_name || null,
      credit: s.credit,
      credit_note: CONFLICTING_CREDIT[s.id] ?? null,
      meals: s.meals.filter((m): m is Meal => m === 'breakfast' || m === 'lunch' || m === 'dinner'),
      hours: HOURS[s.id] ?? null,
      mobile_order: MOBILE_ORDER[s.id] ?? null,
      seasonal: SEASONAL_LOCATIONS.has(s.id),
      lat: s.lat ?? coord?.lat ?? null,
      lng: s.lng ?? coord?.lng ?? null,
      coord_source: s.lat != null ? 'manual' : coord?.source ?? null,
      google_place_id: coord?.place_id ?? null,
      logo_path: null,
      hero_path: photos[0]?.path ?? null,
      hero_attribution: photos[0]?.attribution ?? null,
      photos,
      theme_id: defaultThemeId({ id: s.id, park_id, area_label: s.area }),
      menu_as_of: s.menu_as_of || null,
      sources: s.sources ?? [],
      notes: cleanNote(s.notes),
      updated_at: stamp,
    });

    const onQs = s.credit === 'quick_service';
    const groups: [ItemSection | 'snacks', SeedItem[]][] = [
      ['entree', s.entrees],
      ['kids', s.kids],
      ['snacks', s.snacks],
    ];
    let sort = 0;
    for (const [group, items] of groups) {
      for (const it of items) {
        const note = cleanNote(it.note);
        const section: ItemSection = group === 'snacks' ? (isDrink(it.item) ? 'drink' : 'snack') : group;
        const mainCourse = section === 'entree' || section === 'kids';
        let qs: Tri = 'no';
        if (mainCourse) qs = !onQs ? 'no' : note && QS_UNCONFIRMED.test(note) ? 'unknown' : 'yes';
        menu_items.push({
          id: stableUuid(`${s.id}|${group}|${sort}|${it.item}`),
          location_id: s.id,
          section,
          name: it.item,
          price_usd: typeof it.price === 'number' ? it.price : null,
          qs_eligible: qs,
          snack_eligible: triFrom(it.snackCredit),
          seasonal: isSeasonalNote(note),
          note,
          sort: sort++,
          updated_at: stamp,
        });
      }
    }
  }

  return { parks: PARKS, lands: [...lands.values()], locations, menu_items, refill_stations: refills };
}

/** QS counters double as refill points: any QS counter gives a free cup of ice water. */
export function counterCupRefills(locations: Location[]): RefillStation[] {
  return locations
    .filter((l) => l.credit === 'quick_service' && l.lat != null && l.lng != null)
    .map((l) => ({
      id: `cup:${l.id}`,
      park_id: l.park_id,
      kind: 'qs_counter_cup' as const,
      lng: l.lng!,
      lat: l.lat!,
      indoor: null,
      description: `Free cup of ice water at the ${l.name} counter`,
      osm_id: null,
      last_confirmed: null,
      updated_at: l.updated_at,
    }));
}
