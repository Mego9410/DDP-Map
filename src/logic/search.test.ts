import { describe, expect, it } from 'vitest';
import { searchLocations } from './search';
import { seedData } from '../test/seedData';

describe('search', () => {
  const { locations, menu_items } = seedData();

  it('"pizza" finds names and menu items (TRD step 8)', () => {
    const ids = searchLocations('pizza', locations, menu_items).map((h) => h.location.id);
    for (const id of ['pizzafari', 'pizza-al-taglio', 'blaze-fast-fire-d-pizza', 'pizza-ponte']) expect(ids).toContain(id);
  });

  it('matches menu items and reports which ones', () => {
    const hits = searchLocations('lobster roll', locations, menu_items);
    for (const h of hits) {
      const nameMatch = /lobster/i.test(h.location.name);
      expect(nameMatch || h.items.length > 0).toBe(true);
    }
  });

  it('is accent-insensitive', () => {
    const ids = searchLocations('crepes', locations, menu_items).map((h) => h.location.id);
    expect(ids).toContain('cr-pes-emporter');
  });

  it('empty query returns everything', () => {
    expect(searchLocations('  ', locations, menu_items)).toHaveLength(locations.length);
  });
});
