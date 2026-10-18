import { describe, expect, it } from 'vitest';
import { seedData } from '../test/seedData';
import { counterCupRefills, normalizeSeed, type CoordFile, type SeedFile } from './normalize';
import { validateLocationPatch } from './validate.js';
import seed from '../../seed/locations.json';
import coords from '../../seed/coordinates.json';
import { parkForPoint } from './parks.js';

describe('normalizeSeed', () => {
  const d = seedData();

  it('has all 66 locations with coordinates', () => {
    expect(d.locations).toHaveLength(66);
    for (const l of d.locations) {
      expect(l.lat, l.id).not.toBeNull();
      expect(l.lng, l.id).not.toBeNull();
    }
  });

  it('every pin sits inside its park outline', () => {
    for (const l of d.locations) expect(parkForPoint(l.lng!, l.lat!), l.id).toBe(l.park_id);
  });

  it('menu item ids are unique and stable', () => {
    const ids = d.menu_items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(seedData().menu_items.map((i) => i.id)).toEqual(ids);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('keeps every seed item', () => {
    expect(d.menu_items).toHaveLength(1030);
  });

  it('entrées and kids meals at QS places default to QS-eligible', () => {
    const qsLocs = new Set(d.locations.filter((l) => l.credit === 'quick_service').map((l) => l.id));
    const main = d.menu_items.filter((i) => qsLocs.has(i.location_id) && (i.section === 'entree' || i.section === 'kids'));
    expect(main.filter((i) => i.qs_eligible === 'yes').length).toBeGreaterThan(main.length - 5);
  });

  it('snack eligibility maps from the seed tri-state', () => {
    const counts = { yes: 0, no: 0, unknown: 0 };
    for (const i of d.menu_items) if (i.section === 'snack' || i.section === 'drink') counts[i.snack_eligible]++;
    expect(counts).toEqual({ yes: 25, no: 13, unknown: 428 });
  });

  it('every location has a land and menu date', () => {
    const lands = new Set(d.lands.map((l) => l.id));
    for (const l of d.locations) {
      expect(lands.has(l.land_id!)).toBe(true);
      expect(l.menu_as_of).toMatch(/^2026-\d\d-\d\d$/);
    }
  });

  it('QS counters become counter-cup refill points', () => {
    const cups = counterCupRefills(d.locations);
    expect(cups.length).toBe(d.locations.filter((l) => l.credit === 'quick_service').length);
    expect(cups.every((c) => c.kind === 'qs_counter_cup')).toBe(true);
  });

  it('attaches photos shipped in /photos (cover first) and ignores database-only ones', () => {
    const d2 = normalizeSeed(seed as SeedFile, coords as CoordFile, [], {
      pizzafari: [
        { attribution: 'Photo: A, CC BY 2.0, via Wikimedia Commons', license: 'CC BY 2.0', source_url: 'https://commons.wikimedia.org/wiki/File:A.jpg', media_path: '/photos/pizzafari-1.jpg' },
        { attribution: 'Photo: B, CC0, via Wikimedia Commons', license: 'CC0', source_url: 'https://commons.wikimedia.org/wiki/File:B.jpg', media_path: '/api/media/00000000-0000-4000-8000-000000000001' },
        { attribution: 'Photo: C', license: 'CC0', source_url: 'https://commons.wikimedia.org/wiki/File:C.jpg' },
      ],
    });
    const p = d2.locations.find((l) => l.id === 'pizzafari')!;
    expect(p.hero_path).toBe('/photos/pizzafari-1.jpg');
    expect(p.hero_attribution).toBe('Photo: A, CC BY 2.0, via Wikimedia Commons');
    expect(p.photos.map((x) => x.path)).toEqual(['/photos/pizzafari-1.jpg']);
    expect(d2.locations.find((l) => l.id === 'casey-s-corner')!.photos).toEqual([]);
  });

  it('accepts shipped and uploaded image paths, nothing else', () => {
    expect(validateLocationPatch({ hero_path: '/photos/pizzafari-1.jpg' })).toBeNull();
    expect(validateLocationPatch({ hero_path: '/api/media/00000000-0000-4000-8000-000000000001' })).toBeNull();
    expect(validateLocationPatch({ hero_path: '/photos/../secret.jpg' })).not.toBeNull();
    expect(validateLocationPatch({ hero_path: 'https://example.com/x.jpg' })).not.toBeNull();
  });
});
