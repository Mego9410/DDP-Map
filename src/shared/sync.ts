// The outbox protocol between the phone (Dexie outbox) and POST /api/sync.

import type { Favourite, Location, MenuItem, RefillStation } from './types.js';

export const EDITABLE_LOCATION_FIELDS = [
  'name', 'short_name', 'credit', 'credit_note', 'meals', 'hours', 'mobile_order', 'seasonal',
  'lng', 'lat', 'coord_source', 'google_place_id', 'logo_path', 'hero_path', 'hero_attribution', 'photos',
  'theme_id', 'menu_as_of', 'notes',
] as const;

export type EditableLocationField = (typeof EDITABLE_LOCATION_FIELDS)[number];
export type LocationPatch = Partial<Pick<Location, EditableLocationField>>;

interface OpBase {
  op_id: string;
  /** Editor's clock, ISO. Last write wins. */
  updated_at: string;
}

export type SyncOp =
  | (OpBase & { kind: 'favourite'; location_id: string; starred: boolean; visited_on: string | null })
  | (OpBase & { kind: 'location'; id: string; patch: LocationPatch })
  | (OpBase & { kind: 'item_upsert'; item: Omit<MenuItem, 'updated_at'> })
  | (OpBase & { kind: 'item_delete'; id: string })
  | (OpBase & { kind: 'refill_upsert'; refill: Omit<RefillStation, 'updated_at'> })
  | (OpBase & { kind: 'refill_delete'; id: string });

export type SyncOpKind = SyncOp['kind'];

export interface SyncResult {
  op_id: string;
  status: 'applied' | 'stale' | 'rejected';
  error?: string;
}

export interface ChangesResponse {
  cursor: string;
  locations: Location[];
  menu_items: MenuItem[];
  refill_stations: RefillStation[];
  favourites: Favourite[];
  deleted: { table_name: 'menu_items' | 'refill_stations'; row_id: string }[];
}

export const ADMIN_OPS: ReadonlySet<SyncOpKind> = new Set([
  'location', 'item_upsert', 'item_delete', 'refill_upsert', 'refill_delete',
]);
