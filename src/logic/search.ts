import type { Location, MenuItem } from '../shared/types';

function fold(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export interface SearchHit {
  location: Location;
  /** Menu items that matched, when the match came from the menu. */
  items: MenuItem[];
}

/** Matches restaurant name, area and menu item names (TRD step 8). */
export function searchLocations(query: string, locations: Location[], items: MenuItem[]): SearchHit[] {
  const q = fold(query.trim());
  if (!q) return locations.map((location) => ({ location, items: [] }));
  const terms = q.split(/\s+/);
  const byLoc = new Map<string, MenuItem[]>();
  for (const it of items) {
    const name = fold(it.name);
    if (terms.every((t) => name.includes(t))) {
      const arr = byLoc.get(it.location_id) ?? [];
      arr.push(it);
      byLoc.set(it.location_id, arr);
    }
  }
  const hits: SearchHit[] = [];
  for (const location of locations) {
    const hay = fold(`${location.name} ${location.short_name ?? ''} ${location.area_label}`);
    const nameHit = terms.every((t) => hay.includes(t));
    const menuHits = byLoc.get(location.id) ?? [];
    if (nameHit || menuHits.length) hits.push({ location, items: menuHits });
  }
  return hits;
}
