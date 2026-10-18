# TRD: Park Plate (personal WDW dining map)

**Companion to:** `PRD.md`
**Status:** Draft v1, 18 Oct 2026
**Build style:** Very small incremental steps, each touching only the files it needs, each with its own acceptance criteria. Inline UI messages only, no `alert()`. Never commit `.env*` files.

---

## 1. Architecture at a glance

```
Phone browser (installable PWA)
 ├─ React + TypeScript (Vite)
 ├─ MapLibre GL JS ── vector map from a self-hosted PMTiles extract of WDW (offline-capable)
 │                 └─ optional satellite layer (online only)
 ├─ Dexie (IndexedDB) ── local copy of locations, menus, refills, themes, favourites
 └─ Service worker (vite-plugin-pwa / Workbox) ── app shell, tiles, photos, fonts
        │
        ▼ (when online)
Supabase
 ├─ Postgres: parks, lands, locations, menu_items, refill_stations, themes, favourites, edits_log
 ├─ Auth: magic-link email, allowlist of 4 family addresses
 ├─ Storage (private bucket): logos, storefront photos, theme textures
 ├─ Realtime: favourites / visited sync
 └─ Edge Function: places-photo proxy (first build only)
```

Hosting: Vercel or Netlify (static), `X-Robots-Tag: noindex` on every response.

## 2. Map provider decision

| Option | Real map | Satellite | Offline in a web app | Cost | Verdict |
|---|---|---|---|---|---|
| **MapLibre + Protomaps PMTiles extract** | Yes, OpenStreetMap data (park paths, buildings and lands are well mapped at WDW) | Add a raster satellite source when online | **Yes**, the extract is one file you host and cache | Free; ODbL attribution | **Recommended base map** |
| Google Maps JS API | Yes | Yes, best imagery | No: terms forbid caching tiles | Free monthly usage per SKU, then paid; check current pricing | Use only for the one-off geocoding and photo lookups |
| Mapbox GL JS | Yes | Yes | Limited; caching beyond browser cache not allowed | Free tier, then paid | Fine alternative if offline is dropped |
| Apple MapKit JS | Yes | Yes | No | Needs a paid Apple Developer account | Not worth it here |

**Decision:** MapLibre GL JS with a Protomaps PMTiles extract cropped to the WDW bounding box as the base map, plus an optional satellite toggle (MapTiler or Esri World Imagery raster, online only, with attribution). This is the only option that meets US6 (offline in the parks).

WDW bounding box for the extract (lon/lat): `-81.62, 28.33, -81.50, 28.43`. Expected file size is a few MB at zoom 12–18.

```bash
# one-off, run locally
pmtiles extract https://build.protomaps.com/<latest>.pmtiles public/tiles/wdw.pmtiles \
  --bbox=-81.62,28.33,-81.50,28.43 --maxzoom=18
```

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | React 18 + TypeScript + Vite | Matches your existing builds |
| Map | `maplibre-gl` + `pmtiles` protocol + `@protomaps/basemaps` style | Offline vector map |
| Bottom sheet | `vaul` (or a small custom sheet) | Draggable details over the map |
| State | Zustand | Filters, selection, map view |
| Local data | Dexie (IndexedDB) | Offline reads and queued writes |
| Backend | Supabase (Postgres, Auth, Storage, Realtime, Edge Functions) | Family sync and in-app editing |
| PWA | `vite-plugin-pwa` (Workbox) | Installable, offline caching |
| Styling | CSS modules + CSS custom properties for themes | Per-restaurant theme tokens swap at runtime |
| Tests | Vitest (logic), Playwright (e2e incl. offline) | |

## 4. Data model (Postgres)

```sql
create table parks (
  id text primary key,                 -- 'magic-kingdom'
  name text not null,
  center_lng double precision not null,
  center_lat double precision not null,
  default_zoom real not null default 16
);

create table lands (
  id text primary key,                 -- 'mk-frontierland'
  park_id text references parks(id),
  name text not null
);

create type credit_type as enum ('quick_service', 'snack', 'none');

create table locations (
  id text primary key,                 -- slug, 'pecos-bill-tall-tale-inn-and-cafe'
  park_id text references parks(id) not null,
  land_id text references lands(id),
  area_label text not null,            -- 'Frontierland'
  name text not null,
  short_name text,
  credit credit_type not null,
  credit_note text,                    -- e.g. 'Sources disagree; confirm at counter'
  meals text[] not null default '{}',  -- {'breakfast','lunch','dinner'}
  mobile_order boolean,
  seasonal boolean not null default false,
  lng double precision,
  lat double precision,
  google_place_id text,
  logo_path text,                      -- storage path in private bucket
  hero_path text,
  hero_attribution text,               -- required if photo came from Google
  theme_id text references themes(id),
  menu_as_of date,
  sources text[] not null default '{}',
  notes text,
  updated_at timestamptz not null default now()
);

create type item_section as enum ('entree', 'kids', 'snack', 'drink');
create type tri as enum ('yes', 'no', 'unknown');

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  location_id text references locations(id) on delete cascade,
  section item_section not null,
  name text not null,
  price_usd numeric(6,2),              -- null = not listed
  qs_eligible tri not null default 'unknown',
  snack_eligible tri not null default 'unknown',
  seasonal boolean not null default false,
  note text,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

create type refill_kind as enum ('bottle_filler', 'fountain', 'qs_counter_cup');

create table refill_stations (
  id uuid primary key default gen_random_uuid(),
  park_id text references parks(id) not null,
  kind refill_kind not null,
  lng double precision not null,
  lat double precision not null,
  indoor boolean,
  description text,                    -- 'By the restrooms behind Pecos Bill'
  osm_id text,                         -- if seeded from OSM
  last_confirmed date,
  updated_at timestamptz not null default now()
);

create table themes (
  id text primary key,                 -- 'retro-space', 'nautical', 'galaxy-cantina'
  tokens jsonb not null                -- see §7
);

create table favourites (
  user_id uuid references auth.users(id) on delete cascade,
  location_id text references locations(id) on delete cascade,
  starred boolean not null default false,
  visited_on date,
  primary key (user_id, location_id)
);

create table edits_log (
  id bigserial primary key,
  user_id uuid references auth.users(id),
  table_name text not null,
  row_id text not null,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);
```

### Row-level security

- All tables: `select` allowed when `auth.email()` is in a `family_members` allowlist table.
- `favourites`: insert/update/delete only where `user_id = auth.uid()`, but family can read everyone's (so stars are shared).
- `locations`, `menu_items`, `refill_stations`, `themes`: insert/update only for users with `role = 'admin'` in `family_members` (Oliver).
- An `after update` trigger on the editable tables writes to `edits_log`.

## 5. Credit logic

One pure function decides every badge, so the map filter, list and menu all agree.

```ts
type Credit = 'quick_service' | 'snack' | 'none';
type Tri = 'yes' | 'no' | 'unknown';

export type Badge =
  | { kind: 'qs'; label: '1 QS credit' }
  | { kind: 'qs-kids'; label: '1 QS credit (ages 3–9)' }
  | { kind: 'snack'; label: 'Snack credit' }
  | { kind: 'check'; label: 'Check DDP symbol' }
  | { kind: 'cash'; label: 'Cash only' };

export function badgeFor(loc: { credit: Credit }, item: {
  section: 'entree' | 'kids' | 'snack' | 'drink';
  qs_eligible: Tri; snack_eligible: Tri;
}): Badge {
  if (loc.credit === 'none') return { kind: 'cash', label: 'Cash only' };
  if (loc.credit === 'quick_service' && item.qs_eligible !== 'no') {
    if (item.section === 'entree') return { kind: 'qs', label: '1 QS credit' };
    if (item.section === 'kids') return { kind: 'qs-kids', label: '1 QS credit (ages 3–9)' };
  }
  if (item.snack_eligible === 'yes') return { kind: 'snack', label: 'Snack credit' };
  if (item.snack_eligible === 'unknown' && item.section !== 'entree') return { kind: 'check', label: 'Check DDP symbol' };
  return { kind: 'cash', label: 'Cash only' };
}
```

Filter rules:

- **Quick-Service credit** shows locations with `credit = 'quick_service'`.
- **Snack credit** shows locations with `credit = 'snack'` **or** any item with `snack_eligible = 'yes'`.
- **Not on plan** shows `credit = 'none'`.
- Filters are OR'd; none selected means show all.

Unit tests cover every branch, plus the three conflicting-source locations.

## 6. Map behaviour

- Park switcher flies the camera to `parks.center` at `default_zoom`.
- Pins are a GeoJSON source with a symbol layer; colour by `credit` (data-driven style), label with `short_name` from zoom 17.
- Clustering on at zoom < 16 so Disney Springs and EPCOT World Showcase stay readable.
- Refill stations are a second GeoJSON source with a water-drop icon, hidden by default, toggled by a chip.
- Tapping a pin sets `selectedId`, eases the camera so the pin sits above the sheet, opens the sheet at half height.
- Blue dot from `navigator.geolocation.watchPosition` (high accuracy, 10s max age). If denied: inline message in the list header, no blocking dialog.
- Distance: haversine in metres, shown as walking minutes at 80 m/min.

## 7. Themed menus

Each restaurant points at a theme. A theme is a set of tokens applied as CSS custom properties on the menu container.

```json
{
  "id": "retro-space",
  "tokens": {
    "bg": "#0b1030", "ink": "#e8f0ff", "accent": "#ff5ad1", "rule": "#3a4bb8",
    "displayFont": "Orbitron", "bodyFont": "Space Grotesk",
    "texture": "starfield.svg",
    "layout": "board",
    "priceStyle": "dots"
  }
}
```

- **Layouts** (4 to start): `board` (chalkboard/menu board), `card` (paper menu), `scroll` (parchment, Fantasyland), `neon` (Galaxy's Edge, Tomorrowland).
- **Starter themes by land**, then override for the well-known spots: Main Street (vintage diner), Adventureland (tiki/bamboo), Frontierland (wanted-poster), Liberty Square (colonial tavern), Fantasyland (storybook), Tomorrowland (retro space), each EPCOT country, Galaxy's Edge (spaceport), Toy Story Land (toy box), Pandora (bioluminescent), Africa/Asia (market), Disney Springs (each brand's own look).
- Fonts are limited to ~12 Google Fonts families, self-hosted in `/public/fonts` so they work offline.
- Every theme must pass WCAG AA contrast for body text; a test checks `ink` against `bg`.
- Logo sits top-left of the menu header, hero photo above it full-bleed with the attribution line if from Google.

## 8. Data pipeline

### 8.1 Seed

`seed/locations.json` (provided) holds all 66 locations: park, area, credit, meals, entrées, kids' meals and snacks with prices, notes, sources and menu dates gathered 26 Sep – 18 Oct 2026. `lat`/`lng` are empty.

`scripts/seed.ts` reads it and upserts `parks`, `lands`, `locations` and `menu_items`. Item eligibility defaults: entrées and kids → `qs_eligible = 'yes'` where the location is QS; everything → `snack_eligible = 'unknown'` unless the seed says otherwise.

### 8.2 Coordinates (one-off)

`scripts/geocode.ts` calls Google **Places API (New) Text Search** with `"<name> <park> Walt Disney World"`, takes the top result's `location` and `id`, and writes them to `locations`. Then open the in-app **Move pin** admin mode (drag a pin, save) to fix any counter that lands on the wrong building.

### 8.3 Refill stations (one-off)

Seed from OpenStreetMap via Overpass, then verify on the trip:

```
[out:json][timeout:60];
(
  node["amenity"="drinking_water"](28.33,-81.62,28.43,-81.50);
  node["drinking_water"="yes"](28.33,-81.62,28.43,-81.50);
);
out body;
```

`scripts/refills.ts` imports results as `kind = 'fountain'` (or `bottle_filler` when `bottle=yes`), assigns `park_id` by point-in-polygon against simple park outlines, and leaves `last_confirmed` empty. OSM coverage inside the parks may be patchy, so the admin **Add refill here** button (long-press on the map) is the main way to fill gaps. Add a static info card: any QS counter gives a free cup of ice water.

### 8.4 Photos and logos

- First build: `functions/places-photo` (Supabase Edge Function) fetches a Places photo by `google_place_id`, returns it with the `authorAttributions` string, and the client shows the attribution. Don't store Google photos in your bucket.
- On the trip: the admin **Replace photo** button uploads your own shot to the private bucket (`hero_path`), resized client-side to 1600px WebP. Logos are uploaded the same way (`logo_path`, PNG/SVG).
- Private bucket, signed URLs (24h), cached by the service worker.

### 8.5 Ongoing edits

Admin edit forms on the detail sheet for price, name, eligibility, notes and "menu as of" date. Every save writes to `edits_log`. No automated scraping of Disney or third-party menu sites.

## 9. Offline and sync

| Asset | Strategy |
|---|---|
| App shell (HTML/JS/CSS, fonts, icons) | Precache |
| `wdw.pmtiles` | Cached in full on first map open (range-request aware cache), refreshed monthly |
| Satellite tiles | Network only (online toggle) |
| Logos, photos, textures | Cache-first, 30-day expiry |
| Supabase data | Synced into Dexie on launch and every 5 min online; UI reads from Dexie only |
| Favourites/edits made offline | Queued in Dexie `outbox`, flushed on reconnect; last-write-wins by `updated_at` |

An inline banner shows "Offline – showing menus saved on <date>" when `navigator.onLine` is false.

## 10. Project structure

```
park-plate/
  public/
    tiles/wdw.pmtiles
    fonts/
    icons/
  seed/locations.json
  scripts/  seed.ts  geocode.ts  refills.ts
  supabase/
    migrations/0001_init.sql
    functions/places-photo/index.ts
  src/
    app/        App.tsx  routes.tsx
    map/        MapView.tsx  layers.ts  style.ts
    sheet/      DetailSheet.tsx  Menu.tsx  themes.ts
    list/       ListView.tsx
    filters/    FilterBar.tsx
    data/       db.ts (Dexie)  sync.ts  supabase.ts
    logic/      credits.ts  distance.ts
    admin/      EditItem.tsx  MovePin.tsx  AddRefill.tsx
    store.ts
  .env.example              # committed, no values
  .gitignore                # includes .env, .env.local, .env.*
```

Environment variables (`.env.local`, never committed):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SATELLITE_TILE_URL=      # optional
GOOGLE_PLACES_API_KEY=        # scripts and edge function only, never exposed to the client
```

## 11. Build plan (small steps, each shippable)

Each step changes only the files listed. Don't start the next step until the acceptance criteria pass.

| # | Step | Files | Acceptance criteria |
|---|---|---|---|
| 1 | Scaffold Vite + React + TS, `.gitignore` with env files, `.env.example` | root config | `npm run dev` shows a blank page; `git status` shows no `.env*` |
| 2 | Map with PMTiles base, centred on Magic Kingdom | `map/MapView.tsx`, `map/style.ts`, `public/tiles/` | Can pan/zoom MK on a phone; OSM attribution visible |
| 3 | Load `seed/locations.json` locally, render pins from hard-coded test coordinates for 3 MK spots | `map/layers.ts`, `data/seed.ts` | 3 pins show, coloured by credit |
| 4 | Park switcher | `filters/FilterBar.tsx`, `store.ts` | Each of 5 parks flies to its centre |
| 5 | Credit logic + tests | `logic/credits.ts`, `credits.test.ts` | All branches tested; tests pass |
| 6 | Credit filter chips wired to map | `filters/FilterBar.tsx`, `map/layers.ts` | Toggling chips hides/shows pins; none selected shows all |
| 7 | Detail sheet with menu sections and badges (unthemed) | `sheet/DetailSheet.tsx`, `sheet/Menu.tsx` | Tapping a pin opens sheet; every item shows price and correct badge |
| 8 | List view with search | `list/ListView.tsx` | Search "pizza" matches restaurant names and menu items, so results include at least Pizzafari, Pizza al Taglio, Blaze and Pizza Ponte |
| 9 | Supabase project, migration, RLS, magic-link login for allowlist | `supabase/migrations`, `data/supabase.ts` | Non-allowlisted email can't read data (inline message shown) |
| 10 | `scripts/seed.ts` into Supabase; app reads from Supabase → Dexie | `scripts/seed.ts`, `data/db.ts`, `data/sync.ts` | 66 locations and all items in DB; app works with network then offline reload |
| 11 | `scripts/geocode.ts` + Move pin admin mode | `scripts/geocode.ts`, `admin/MovePin.tsx` | All 66 have coordinates; dragging a pin saves and logs to `edits_log` |
| 12 | Near me + distance sort | `logic/distance.ts`, `list/ListView.tsx` | With location on, list sorted nearest first; denied shows inline message |
| 13 | Refill layer + Overpass import + Add refill | `scripts/refills.ts`, `map/layers.ts`, `admin/AddRefill.tsx` | Toggle shows refill pins; long-press adds one |
| 14 | Themes: tokens, 4 layouts, land defaults | `sheet/themes.ts`, `sheet/Menu.tsx`, `public/fonts` | Every location renders in a theme; contrast test passes |
| 15 | Photos and logos (Places proxy + upload) | `functions/places-photo`, `admin/` | Hero photo with attribution shows; uploaded photo replaces it |
| 16 | Favourites + Realtime | `data/sync.ts`, `sheet/DetailSheet.tsx` | Star on phone A appears on phone B within 5s |
| 17 | Admin item editing | `admin/EditItem.tsx` | Price edit shows for everyone and appears in `edits_log` |
| 18 | PWA + offline caching + outbox | `vite.config.ts`, `data/sync.ts` | Playwright: open MK online, go offline, reload, open Pecos Bill menu with photo |
| 19 | `noindex` headers, deploy | `vercel.json` / `netlify.toml` | Deployed URL requires login; response has `X-Robots-Tag: noindex` |

## 12. Testing

- **Unit (Vitest):** `badgeFor`, filter rules, distance, theme contrast.
- **E2E (Playwright, mobile viewport):** filter → pin → sheet → menu; search; offline reload; login gate.
- **Field test:** before the trip, walk through one park's data on Wi-Fi, switch to airplane mode, confirm every sheet opens.

## 13. Risks

| Risk | Mitigation |
|---|---|
| Menus and prices drift before the trip | "Menu as of" date on every sheet; refresh pass the week before flying |
| Snack eligibility unknown for most items | Tri-state flag, "Check DDP symbol" badge, update on the trip |
| OSM refill data thin inside parks | Long-press to add; field verification |
| Places coordinates off by a building | Move pin mode |
| Google photo terms | Show attribution; replace with own photos; don't store Google images |
| Disney IP in logos/photos | Private bucket, login wall, `noindex`, no public repo |
