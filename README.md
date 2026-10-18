# DDP-Map

**Park Plate** — a private, phone-first map of Walt Disney World quick-service
dining and water refill points, built around the Disney Dining Plan.

Filter the map by credit type (Quick-Service, Snack, Not on plan), tap a pin to
read that restaurant's menu in its own theme, and see what each item costs in
credits. Works offline once a park has been opened on Wi-Fi.

This is a personal app for one family's trip. It is not published or promoted,
sits behind a login, and is served `noindex`.

## Documents

| File | What it covers |
|---|---|
| [`PRD.md`](PRD.md) | Problem, scope, user stories, content plan, milestones |
| [`TRD.md`](TRD.md) | Architecture, data model, credit logic, 19-step build plan |

## Repository layout

```
seed/locations.json   66 quick-service locations with menus and prices
                      (gathered by hand 26 Sep – 18 Oct 2026; lat/lng empty)
PRD.md  TRD.md        product and technical requirements
.env.example          environment variables, no values
```

The application scaffold (Vite + React + TypeScript, MapLibre, Supabase, Dexie)
follows in step 1 of the TRD build plan.

## Seed data

`seed/locations.json` is the single source of truth for the first load:

```json
{ "generated": "2026-10-18", "count": 66, "locations": [ … ] }
```

Each location carries `park`, `area`, `credit`, `meals`, and `entrees`, `kids`
and `snacks` arrays with prices. Coordinates are `null` until
`scripts/geocode.ts` runs (TRD §8.2). Prices drift — every detail sheet shows a
"menu as of" date.

## Ground rules

- Never commit `.env` files. Secrets live in `.env.local` and the host's
  environment.
- No Disney logos, artwork or storefront photos in this repository; they belong
  in the private Supabase bucket (PRD §8).
- No automated scraping of Disney or third-party menu sites. Menu data is
  maintained by hand, in-app.
- Google Places photos need photographer attribution shown and must not be
  cached long-term.
