// Shared between the client, the Vercel functions in /api and /scripts.
// Field names match the Postgres columns in db/migrations.

export type Credit = 'quick_service' | 'snack' | 'none';
export type Tri = 'yes' | 'no' | 'unknown';
export type ItemSection = 'entree' | 'kids' | 'snack' | 'drink';
export type RefillKind = 'bottle_filler' | 'fountain' | 'qs_counter_cup';
export type Meal = 'breakfast' | 'lunch' | 'dinner';
export type CoordSource = 'approx' | 'places' | 'manual';
export type Role = 'admin' | 'member';

export interface Park {
  id: string;
  name: string;
  short_name: string;
  center_lng: number;
  center_lat: number;
  default_zoom: number;
}

export interface Land {
  id: string;
  park_id: string;
  name: string;
}

export interface Location {
  id: string;
  park_id: string;
  land_id: string | null;
  area_label: string;
  name: string;
  short_name: string | null;
  credit: Credit;
  credit_note: string | null;
  meals: Meal[];
  hours: string | null;
  mobile_order: boolean | null;
  seasonal: boolean;
  lng: number | null;
  lat: number | null;
  coord_source: CoordSource | null;
  google_place_id: string | null;
  logo_path: string | null;
  hero_path: string | null;
  hero_attribution: string | null;
  theme_id: string | null;
  menu_as_of: string | null;
  sources: string[];
  notes: string | null;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  location_id: string;
  section: ItemSection;
  name: string;
  price_usd: number | null;
  qs_eligible: Tri;
  snack_eligible: Tri;
  seasonal: boolean;
  note: string | null;
  sort: number;
  updated_at: string;
}

export interface RefillStation {
  id: string;
  park_id: string;
  kind: RefillKind;
  lng: number;
  lat: number;
  indoor: boolean | null;
  description: string | null;
  osm_id: string | null;
  last_confirmed: string | null;
  updated_at: string;
}

export interface Favourite {
  user_email: string;
  location_id: string;
  starred: boolean;
  visited_on: string | null;
  updated_at: string;
}

export type TextureId =
  | 'none' | 'starfield' | 'paper' | 'parchment' | 'chalk' | 'wood' | 'waves'
  | 'stripes' | 'pinstripe' | 'grid' | 'lattice' | 'tile' | 'zellige' | 'plaid'
  | 'gingham' | 'deco' | 'rust' | 'bioglow' | 'leaves' | 'dots' | 'seigaiha' | 'papel';

export type Layout = 'board' | 'card' | 'scroll' | 'neon';
export type PriceStyle = 'dots' | 'plain' | 'tag';

export interface ThemeTokens {
  bg: string;
  ink: string;
  muted: string;
  accent: string;
  rule: string;
  displayFont: string;
  bodyFont: string;
  texture: TextureId;
  layout: Layout;
  priceStyle: PriceStyle;
}

export interface Theme {
  id: string;
  label: string;
  tokens: ThemeTokens;
}

/** Everything the client caches, as served by GET /api/data. */
export interface DataSnapshot {
  generated_at: string;
  parks: Park[];
  lands: Land[];
  locations: Location[];
  menu_items: MenuItem[];
  refill_stations: RefillStation[];
  favourites: Favourite[];
  theme_overrides: Theme[];
  family: { email: string; name: string | null }[];
}

export interface SessionUser {
  email: string;
  name: string | null;
  role: Role;
}
