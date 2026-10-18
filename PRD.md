# PRD: Park Plate (personal WDW dining map)

**Owner:** Oliver Acton
**Status:** Draft v1, 18 Oct 2026
**Use:** Private, personal use for the family Orlando trip. Not published or promoted.

---

## 1. Problem

On the Disney Dining Plan, deciding where to eat in a park means juggling three things at once: where you are, what each counter sells, and whether it takes a Quick-Service credit, a snack credit, or neither. Disney's app shows menus one restaurant at a time and doesn't let you filter by credit type or see refill points on the same map.

## 2. Goal

One phone-first web app that shows every quick service location and water refill point on a real map of Walt Disney World. You can filter by credit type, tap a restaurant to see its themed menu with photos, and see which items your credits cover.

## 3. Users

- **Primary:** Oliver, on his phone, in the parks, often with patchy signal.
- **Secondary:** his partner and two daughters looking at the same shortlist on their own phones.

## 4. Scope

### In scope (v1)

| # | Feature | Detail |
|---|---------|--------|
| F1 | Real interactive map | Satellite and street map of Magic Kingdom, EPCOT, Hollywood Studios, Animal Kingdom and Disney Springs. Pinch-zoom, pan, park switcher. |
| F2 | Restaurant pins | All 66 quick service locations at their real positions, coloured by credit type. |
| F3 | Credit filter | Toggle: Quick-Service credit, Snack credit only, Not on plan. Multi-select. Filter applies to map and list together. |
| F4 | Refill stations | Separate toggleable layer showing water bottle refill points and drinking fountains, plus the "free ice water at any QS counter" rule. |
| F5 | Restaurant detail sheet | Opens from a pin or list row. Hero photo of the storefront, the restaurant's logo, area, hours, mobile order flag and the full menu. |
| F6 | Themed menus | Each menu renders in a style that matches that restaurant (e.g. retro sci-fi for Cosmic Ray's, nautical for Columbia Harbour House), using colours, type and a texture defined per restaurant. |
| F7 | Credit badges per item | Every item shows what it costs in credits: "1 QS credit", "Snack credit", "Cash only", or "Check DDP symbol" when eligibility isn't confirmed. |
| F8 | List view | Searchable list sorted by distance from you (when location is allowed) or by name. |
| F9 | Near me | Blue dot for your position and "nearest QS / nearest refill" shortcuts. |
| F10 | Favourites and visited | Star a place, mark as eaten. Syncs across the family's phones. |
| F11 | Offline | Menus, photos and map tiles for the parks you've opened stay available with no signal. |
| F12 | Data editing | Oliver can correct a price, item or eligibility flag from inside the app without redeploying. |

### Out of scope (v1)

- Table service restaurants, lounges and roaming snack carts (v2 candidates).
- Ordering or mobile-order integration with Disney.
- Live wait times or live prices from Disney.
- Accounts for anyone outside the family.
- Resort hotel dining (v2 candidate).

## 5. User stories and acceptance criteria

**US1 – See where I can eat on a QS credit near me**
Given I'm in Magic Kingdom with location on, when I set the filter to "Quick-Service credit" only, then the map shows only QS-credit pins, the list is sorted nearest first, and each row shows walking distance.

**US2 – Check a menu before walking over**
When I tap the Pecos Bill pin, a bottom sheet opens with its storefront photo, logo, area, hours, and a themed menu. Each entrée shows its price and "1 QS credit". Kids' meals show "1 QS credit (ages 3–9)".

**US3 – Use up a snack credit**
When I filter to "Snack credit", I see snack-only places plus QS places that sell snack-eligible items, and each item flagged snack-eligible shows a snack badge. Items with unknown eligibility say "Check DDP symbol".

**US4 – Refill water bottles**
When I toggle "Refill stations", refill points appear as water-drop pins. Tapping one shows type (bottle filler / fountain / QS counter cup), indoor or outdoor, and a "last confirmed" date.

**US5 – Plan as a family**
When I star Satu'li Canteen on my phone, my partner sees the star on hers within a few seconds (online) or next time she's online.

**US6 – No signal in the park**
After opening a park once on Wi-Fi, with airplane mode on I can still pan the map at the zoom levels I viewed, open every restaurant in that park and read its full menu with photos.

**US7 – Fix a wrong price**
When I'm logged in as admin and edit an item price, the change shows for the whole family immediately and records who changed it and when.

## 6. Content requirements

| Content | Source plan | Notes |
|---------|-------------|-------|
| Menus and prices | Seed from `seed/locations.json` (gathered 26 Sep – 18 Oct 2026); maintain by hand in-app | Prices change often; show "menu as of" date on every sheet. |
| Credit type per location | Seed file + Disney Food Blog 2026 Dining Plan list | Three locations have conflicting sources (Trolley Car Cafe, Amorette's, Yak & Yeti Local Food Cafes); show a "confirm at counter" note. |
| Snack eligibility per item | Manual, from the DDP symbol on menu boards | Tri-state: yes / no / unknown. Default unknown. |
| Coordinates | Google Places API lookup per restaurant, then hand-checked | Store lat/lng in data; don't call Places at runtime. |
| Storefront photos | Your own photos taken on the trip, plus Google Places photos for the first build | See §8. |
| Logos | Your own uploads | See §8. |
| Refill stations | OpenStreetMap `amenity=drinking_water` in each park + manual adds | Seed then verify on the trip; each has a "last confirmed" date. |
| Themes per restaurant | Hand-authored theme tokens (colours, font pair, texture) | 66 themes; start with a default per land and override for the best-known spots. |

## 7. Design principles

- Phone first, one-handed: map fills the screen, details in a draggable bottom sheet.
- Credit type is the first thing you see on every pin, row and item.
- Inline messages, never browser alerts (e.g. "Location is off. Turn it on to sort by distance.").
- Works in bright sunlight: high contrast, large tap targets (44px+).

## 8. IP and data use

This is a private app, but keeping it private is what keeps it low-risk, so:

- Keep the deployment behind a login (family only) and set `noindex`.
- **Logos and Disney artwork:** upload your own images for personal viewing; don't ship them in a public repo. Keep the assets in a private storage bucket.
- **Google Places photos:** Google's terms require showing the photographer attribution next to each photo and don't allow caching them long-term. Use them as a starting point and replace them with your own trip photos, which you can store and cache freely.
- **Menu data:** don't scrape Disney's site or third-party trackers automatically. The seed data was gathered once by hand; maintain it in-app.

## 9. Success measures

- Find a QS-credit place within a 5-minute walk in under 10 seconds from opening the app.
- Every one of the 66 locations has a menu, coordinates and at least one photo before the trip.
- Works fully offline for every park opened once on Wi-Fi.

## 10. Milestones

| Milestone | Contents | Target |
|-----------|----------|--------|
| M1 | Map + pins + credit filter + list (F1–F3, F8) | Week 1 |
| M2 | Detail sheet + menus with credit badges (F5, F7) | Week 2 |
| M3 | Themed menus, logos, photos (F6) | Week 3 |
| M4 | Refill layer, near me (F4, F9) | Week 3 |
| M5 | Supabase sync, favourites, admin edits (F10, F12) | Week 4 |
| M6 | Offline PWA (F11), on-device test in airplane mode | Week 4 |

Technical detail and the step-by-step build plan are in `TRD.md`.

## 11. Open questions

1. Which hotel are you staying at? Adding its QS spots would be a cheap v1.1.
2. Trip dates? Seasonal spots (Tortuga Tavern, Dockside Diner) and holiday menus depend on them.
3. Do you want table service restaurants on the map too, even without full menus?
