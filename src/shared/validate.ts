// Validation shared by the admin forms and the API. Returns an error message or null.

import type { LocationPatch, SyncOp } from './sync.js';
import { EDITABLE_LOCATION_FIELDS } from './sync.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9-]{1,80}$/;
const TRI = new Set(['yes', 'no', 'unknown']);
const SECTIONS = new Set(['entree', 'kids', 'snack', 'drink']);
const CREDITS = new Set(['quick_service', 'snack', 'none']);
const KINDS = new Set(['bottle_filler', 'fountain', 'qs_counter_cup']);
const MEALS = new Set(['breakfast', 'lunch', 'dinner']);
const COORD = new Set(['approx', 'places', 'manual']);

const isStr = (v: unknown, max = 500): v is string => typeof v === 'string' && v.length <= max;
const optStr = (v: unknown, max = 500) => v === null || isStr(v, max);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const optBool = (v: unknown) => v === null || isBool(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isIso = (v: unknown) => isStr(v, 40) && !Number.isNaN(Date.parse(v as string));

export function isLng(v: unknown): boolean {
  return isNum(v) && v > -81.7 && v < -81.4;
}
export function isLat(v: unknown): boolean {
  return isNum(v) && v > 28.3 && v < 28.5;
}

export function validatePrice(v: unknown): string | null {
  if (v === null) return null;
  if (!isNum(v) || v < 0 || v > 999) return 'Price must be between $0 and $999.';
  if (Math.abs(v * 100 - Math.round(v * 100)) > 1e-6) return 'Price can have at most 2 decimal places.';
  return null;
}

export function validateLocationPatch(p: unknown): string | null {
  if (!p || typeof p !== 'object') return 'Patch must be an object.';
  const patch = p as Record<string, unknown>;
  const keys = Object.keys(patch);
  if (!keys.length) return 'Nothing to change.';
  for (const k of keys) {
    if (!(EDITABLE_LOCATION_FIELDS as readonly string[]).includes(k)) return `Field "${k}" can't be edited.`;
    const v = patch[k];
    switch (k as keyof LocationPatch) {
      case 'name':
        if (!isStr(v, 120) || !v.trim()) return 'Name is required (max 120 characters).';
        break;
      case 'credit':
        if (!CREDITS.has(v as string)) return 'Unknown credit type.';
        break;
      case 'meals':
        if (!Array.isArray(v) || v.some((m) => !MEALS.has(m))) return 'Meals must be breakfast, lunch or dinner.';
        break;
      case 'mobile_order':
        if (!optBool(v)) return 'Mobile order must be yes, no or unknown.';
        break;
      case 'seasonal':
        if (!isBool(v)) return 'Seasonal must be true or false.';
        break;
      case 'lng':
        if (!isLng(v)) return 'Pin is outside Walt Disney World.';
        break;
      case 'lat':
        if (!isLat(v)) return 'Pin is outside Walt Disney World.';
        break;
      case 'coord_source':
        if (v !== null && !COORD.has(v as string)) return 'Unknown coordinate source.';
        break;
      case 'menu_as_of':
        if (v !== null && !(isStr(v, 10) && ISO_DATE.test(v))) return 'Menu date must be YYYY-MM-DD.';
        break;
      case 'notes':
        if (!optStr(v, 4000)) return 'Notes are too long (max 4000 characters).';
        break;
      case 'logo_path':
      case 'hero_path':
        if (v !== null && !(isStr(v, 200) && /^\/api\/media\/[0-9a-f-]{36}$/.test(v))) return 'Image path is invalid.';
        break;
      case 'photos': {
        if (!Array.isArray(v) || v.length > 12) return 'Up to 12 photos per place.';
        for (const ph of v as unknown[]) {
          const x = ph as Record<string, unknown>;
          if (!x || typeof x !== 'object') return 'Photo entry is invalid.';
          if (!(isStr(x.path, 200) && /^\/api\/media\/[0-9a-f-]{36}$/.test(x.path))) return 'Photo path is invalid.';
          if (!optStr(x.attribution, 300) || !optStr(x.license, 60)) return 'Photo credit is too long.';
          if (!(x.source_url === null || (isStr(x.source_url, 500) && /^https:\/\//.test(x.source_url)))) return 'Photo source must be an https link.';
        }
        break;
      }
      case 'theme_id':
        if (v !== null && !(isStr(v, 60) && SLUG.test(v))) return 'Theme id is invalid.';
        break;
      default:
        if (!optStr(v, 500)) return `${k} must be text (max 500 characters).`;
    }
  }
  return null;
}

export function validateItem(item: unknown): string | null {
  if (!item || typeof item !== 'object') return 'Item must be an object.';
  const i = item as Record<string, unknown>;
  if (!isStr(i.id, 36) || !UUID.test(i.id)) return 'Item id is invalid.';
  if (!isStr(i.location_id, 80) || !SLUG.test(i.location_id)) return 'Location id is invalid.';
  if (!SECTIONS.has(i.section as string)) return 'Section must be entrée, kids, snack or drink.';
  if (!isStr(i.name, 200) || !i.name.trim()) return 'Item name is required (max 200 characters).';
  const price = validatePrice(i.price_usd);
  if (price) return price;
  if (!TRI.has(i.qs_eligible as string) || !TRI.has(i.snack_eligible as string)) return 'Eligibility must be yes, no or unknown.';
  if (!isBool(i.seasonal)) return 'Seasonal must be true or false.';
  if (!optStr(i.note, 500)) return 'Note is too long (max 500 characters).';
  if (!Number.isInteger(i.sort)) return 'Sort must be a whole number.';
  return null;
}

export function validateRefill(r: unknown): string | null {
  if (!r || typeof r !== 'object') return 'Refill must be an object.';
  const x = r as Record<string, unknown>;
  if (!isStr(x.id, 36) || !UUID.test(x.id)) return 'Refill id is invalid.';
  if (!isStr(x.park_id, 40) || !SLUG.test(x.park_id)) return 'Park is invalid.';
  if (!KINDS.has(x.kind as string) || x.kind === 'qs_counter_cup') return 'Kind must be bottle filler or fountain.';
  if (!isLng(x.lng) || !isLat(x.lat)) return 'Refill point is outside Walt Disney World.';
  if (!optBool(x.indoor)) return 'Indoor must be yes, no or unknown.';
  if (!optStr(x.description, 300)) return 'Description is too long (max 300 characters).';
  if (x.last_confirmed !== null && !(isStr(x.last_confirmed, 10) && ISO_DATE.test(x.last_confirmed as string))) {
    return 'Last confirmed must be YYYY-MM-DD.';
  }
  if (!optStr(x.osm_id, 40)) return 'OSM id is invalid.';
  return null;
}

export function validateOp(op: unknown): string | null {
  if (!op || typeof op !== 'object') return 'Operation must be an object.';
  const o = op as SyncOp;
  if (!isStr(o.op_id, 64)) return 'Missing op_id.';
  if (!isIso(o.updated_at)) return 'Missing or invalid updated_at.';
  switch (o.kind) {
    case 'favourite':
      if (!isStr(o.location_id, 80) || !SLUG.test(o.location_id)) return 'Location id is invalid.';
      if (!isBool(o.starred)) return 'Starred must be true or false.';
      if (o.visited_on !== null && !(isStr(o.visited_on, 10) && ISO_DATE.test(o.visited_on))) return 'Visited date must be YYYY-MM-DD.';
      return null;
    case 'location':
      if (!isStr(o.id, 80) || !SLUG.test(o.id)) return 'Location id is invalid.';
      return validateLocationPatch(o.patch);
    case 'item_upsert':
      return validateItem(o.item);
    case 'refill_upsert':
      return validateRefill(o.refill);
    case 'item_delete':
    case 'refill_delete':
      return isStr(o.id, 36) && UUID.test(o.id) ? null : 'Id is invalid.';
    default:
      return 'Unknown operation.';
  }
}
