# DDP-Map

**Park Plate** is a private, phone-first map of Walt Disney World quick-service
dining and water refill points, built around the Disney Dining Plan.

Filter the map by credit type (Quick-Service, Snack, Not on plan), tap a pin to
read that restaurant's menu in its own theme, and see what each item costs in
credits. The family shares stars and "eaten here" marks. The admin can fix
prices, eligibility and pin positions from the app. Once you've opened the app
on Wi-Fi it keeps working with no signal.

It's a personal app for one family's trip: it sits behind a login, every
response is `noindex`, and it isn't published or promoted.

| Doc | What it covers |
|---|---|
| [`PRD.md`](PRD.md) | Problem, scope, user stories, content plan |
| [`TRD.md`](TRD.md) | Original architecture and build plan (see [Changes from the TRD](#changes-from-the-trd)) |

## Stack

- **Client:** React 18 + TypeScript + Vite, MapLibre GL 6 with a self-hosted
  Protomaps PMTiles extract (falls back to OSM raster tiles), Zustand, Dexie
  (IndexedDB), `vite-plugin-pwa` (Workbox). Fonts are self-hosted via
  `@fontsource`.
- **Server:** Vercel Functions in [`api/`](api) talking to **Neon Postgres**.
- **Tests:** Vitest (logic, themes, seed, plus API integration against a real
  Postgres) and Playwright (mobile viewport, including an offline reload).

```
api/                Vercel functions (login, data, changes, sync, media, places-photo, edits)
  _lib/             db adapter (Neon HTTP / node-postgres), session cookies, SQL
db/migrations/      Postgres schema (idempotent)
e2e/                Playwright tests + in-browser mock API
public/             icons, robots.txt, tiles/wdw.pmtiles (once generated)
scripts/            migrate, seed, geocode, refills, tiles.sh, icons
seed/               locations.json (66 places), coordinates.json, refills.json
src/
  app/ auth/ admin/ filters/ list/ map/ near/ sheet/ ui/   React UI
  data/             Dexie, API client, sync engine, session, actions
  logic/            credit badges + filters, distance, search
  shared/           types, themes, seed normaliser, validation (used by api/ too)
```

## Set up (one-off)

### 1. Vercel + Neon

1. Import the GitHub repo into Vercel. The framework is detected as Vite and
   `vercel.json` handles the rest.
2. In the Vercel project go to **Storage → Create → Neon** (or connect an
   existing Neon project). This adds `DATABASE_URL` to the project's
   environment variables.
3. Add the other variables under **Settings → Environment Variables**:

   | Variable | Value |
   |---|---|
   | `SESSION_SECRET` | 32+ random characters, e.g. `openssl rand -hex 32` |
   | `FAMILY_PASSCODE` | The passcode the family types with their email |
   | `GOOGLE_PLACES_API_KEY` | Optional. Enables first-build storefront photos |
   | `VITE_SATELLITE_TILE_URL` | Optional. Custom satellite tile URL template |

   Never set `VITE_LOCAL_ONLY` on Vercel.

### 2. Create and fill the database

Locally, pull the env vars and run the scripts against Neon:

```bash
npm ci
npx vercel env pull .env.local          # or copy .env.example and fill it in
npm run db:migrate                      # creates tables, enums and triggers
FAMILY_MEMBERS="you@example.com:admin:Oliver,partner@example.com:member:Sam,..." npm run db:seed
```

`FAMILY_MEMBERS` is the allowlist: `email:role:name`, comma-separated. Only
`admin` can edit. Re-running `db:seed` adds anything missing and keeps in-app
edits. `npm run db:seed -- --force` overwrites places and menus from the seed.

### 3. Offline map tiles

```bash
# needs the pmtiles CLI: https://github.com/protomaps/go-pmtiles/releases
scripts/tiles.sh
git add public/tiles/wdw.pmtiles && git commit -m "Add WDW map extract"
```

The extract is a few MB of OpenStreetMap data. Without it the app uses
OpenStreetMap's raster tiles, and only the tiles you've already viewed work
offline.

### 4. Real coordinates and photos (before the trip)

Each restaurant's cover can be a swipeable gallery of real photos, from
three sources, in this order:

1. **Your own trip photos.** In edit mode, use **Replace cover** or **Add
   photo**. They're resized to 1600px WebP, stored privately, and work
   offline.
2. **Wikimedia Commons.** These are freely licensed (CC BY / BY-SA / CC0 /
   public domain) photos of the restaurants. They're stored privately with
   their credit line and work offline.

   ```bash
   npm run photos                # search Commons, write seed/photos.json (links and credits only)
   # open seed/photos.json and delete any wrong matches
   npm run photos -- --upload    # download the listed photos into Postgres and attach them
   npm run photos -- --to-repo   # or: save them in public/photos/ to ship with the app (no database needed)
   ```

   Photos shipped in `public/photos/` are attached from `seed/photos.json` by
   `db:seed` and in local mode. The app downloads every stored photo in the
   background after launch, so they all work offline, not just the ones
   you've opened.

3. **Google Places (optional).** If you ever have a `GOOGLE_PLACES_API_KEY`,
   run `npm run geocode -- --db` to link places. The app then also shows up
   to five live Google photos per place with the photographer's name. These
   are online only; Google doesn't allow storing them.

**Pin positions, no key needed.** Pins start from hand-placed estimates.
Snap them to the real buildings from OpenStreetMap:

```bash
npm run pins            # updates seed/coordinates.json (source "osm")
npm run pins -- --db    # also updates the database; pins you moved by hand are kept
```

Any restaurant OSM doesn't have keeps its estimate. Fix those with **Move
pin**.

Disney's own photos and logos, and food-blog photos, are copyrighted. They
are deliberately not scraped. Add your own logo shots with **Upload logo**.

Then, in the app as admin, switch on **Menu → Edit mode**, open any place
whose pin is off, and use **Move pin**. **Manage photos** removes any
picture you don't want.

### 5. Refill stations

```bash
npm run refills -- --db     # imports OpenStreetMap drinking_water nodes inside the parks
```

OSM coverage inside the parks is thin. In edit mode, **long-press the map**
(or right-click on desktop) to add a refill point where you're standing. Every
point has a "last confirmed" date. QS counters always count as refill points
(free cup of ice water).

## Develop

```bash
npm ci
VITE_LOCAL_ONLY=true npm run dev   # no backend: seed data, you are admin, edits stay in this browser
npm run dev:full                   # `vercel dev` (needs the Vercel CLI): client + API with .env.local
```

For the API against a local Postgres, point `DATABASE_URL` at
`postgresql://...@localhost/...`. The adapter switches to `node-postgres`
automatically.

## Test

```bash
npm run typecheck
npm test                                        # unit tests
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/parkplate_test npm test   # + API integration (wipes that DB)
npm run e2e                                     # builds, serves and runs Playwright on an iPhone viewport
```

CI (`.github/workflows/ci.yml`) runs all three with a Postgres service.

The Playwright suite covers the PRD user stories:

- US1: QS filter and nearest-first list
- US2: Pecos Bill themed menu with badges
- US3: snack credit filter
- US4: refill layer
- US5: family stars sync
- US6: airplane-mode reload
- US7: admin price edit
- login gate, `noindex`, and an inline (non-dialog) message when location is denied

## How it works

- **Credit badges** come from one function, `badgeFor` in
  [`src/logic/credits.ts`](src/logic/credits.ts), so the map, list and menus
  always agree. Filters are ORed. "Snack credit" also includes QS counters
  that sell a confirmed snack-eligible item.
- **Offline:**
  - The app shell, fonts and map worker are precached.
  - The PMTiles extract is stored whole on first map open and refreshed monthly.
  - Photos are cached for 30 days.
  - All data lives in IndexedDB. The UI only reads from IndexedDB.
  - Writes made offline queue in an outbox and flush when the phone is back online.
- **Sync:**
  - The app polls `/api/changes` every 5 s while visible and every 5 min in the background.
  - Last write wins, using each write's `updated_at`.
  - The server tracks its own `changed_at`, so a phone with a slow clock never misses a row.
- **Edits log:** every insert, update or delete made through the API is written
  to `edits_log` with the editor's email. Admins see it under **Menu → Edit history**.
- **Themes:** 51 hand-authored themes. Each land has a default, and the
  well-known spots have overrides. There are four layouts (board, card, scroll,
  neon) with textures drawn as inline SVG. A unit test checks every theme passes
  WCAG AA contrast for body text.

## IP and data rules

- No Disney logos, artwork or storefront photos in this repository. Uploaded
  images are stored in Postgres and served only to signed-in family members.
- Google Places photos are shown with their author attribution and are never
  stored or cached long-term. Wikimedia Commons photos are used only under
  free licences, with their credit line on the photo.
- No automated scraping of Disney or third-party menu sites. The seed was
  gathered by hand. Maintain it in-app.
- Never commit `.env*` files (`.env.example` excepted).

## Changes from the TRD

| TRD | Built | Why |
|---|---|---|
| Supabase (Postgres, Auth, Storage, Realtime, Edge Functions) | Neon Postgres + Vercel Functions | Owner's choice |
| Magic-link auth + RLS | Allowlisted email + family passcode → signed HttpOnly session cookie (90 days). Allowlist re-checked on every request | No email provider needed; data is reachable only through the API |
| Realtime for favourites | Polling `/api/changes` every 5 s while open | Meets "within a few seconds" without a websocket service |
| Private storage bucket | `media` table in Postgres, served by `/api/media/:id` behind the session | Keeps photos private with no extra service |
| Symbol layer pins + labels | HTML marker pins (44px buttons) with supercluster clustering. Base-map label layers dropped | Avoids glyph/sprite downloads, so the map works fully offline |
| Coordinates from Places before first build | Hand-placed estimates (`approx`), then `npm run pins` (OpenStreetMap, no key) + Move pin. `npm run geocode` (Places) stays optional | No Places key available. Pins are flagged until fixed |
| `badgeFor` as written | Same, plus: an entrée explicitly marked `qs_eligible = unknown` shows "Check DDP symbol" | Two "party size" items had unconfirmed eligibility |
