import { describe, expect, it } from 'vitest';
import { matchPins, osmNames, overpassQuery, type OsmElement, type PinTarget } from './_osm.js';
import { WDW_BBOX } from '../src/shared/parks.js';

const node = (id: number, lat: number, lon: number, tags: Record<string, string>): OsmElement => ({ type: 'node', id, lat, lon, tags });
const way = (id: number, lat: number, lon: number, tags: Record<string, string>): OsmElement => ({ type: 'way', id, center: { lat, lon }, tags });

const T = (id: string, park_id: string, names: string[], lat: number | null = null, lng: number | null = null): PinTarget => ({ id, park_id, names, lat, lng });

describe('OSM pin matching', () => {
  it('matches by name inside the right park and uses way centres', () => {
    const m = matchPins(
      [T('cosmic-ray-s-starlight-cafe', 'magic-kingdom', ["Cosmic Ray's Starlight Café", "Cosmic Ray's"])],
      [way(101, 28.41862, -81.57905, { amenity: 'fast_food', name: "Cosmic Ray's Starlight Café" })],
    );
    expect(m).toEqual([{ id: 'cosmic-ray-s-starlight-cafe', lat: 28.41862, lng: -81.57905, osm_id: 'way/101', osm_name: "Cosmic Ray's Starlight Café", score: 1 }]);
  });

  it('ignores a same-named feature in another park', () => {
    const m = matchPins(
      [T('pizzafari', 'animal-kingdom', ['Pizzafari'])],
      [node(1, 28.4190, -81.5815, { amenity: 'restaurant', name: 'Pizzafari' })], // inside Magic Kingdom
    );
    expect(m).toEqual([]);
  });

  it('sends near-duplicate names to the right restaurant', () => {
    const targets = [
      T('connections-eatery', 'epcot', ['Connections Eatery']),
      T('connections-caf-starbucks', 'epcot', ['Connections Café', 'Connections Café']),
    ];
    const els = [
      node(1, 28.3742, -81.5484, { amenity: 'fast_food', name: 'Connections Eatery' }),
      node(2, 28.37445, -81.54815, { amenity: 'cafe', name: 'Connections Cafe', brand: 'Starbucks' }),
    ];
    const m = Object.fromEntries(matchPins(targets, els).map((x) => [x.id, x.osm_id]));
    expect(m).toEqual({ 'connections-eatery': 'node/1', 'connections-caf-starbucks': 'node/2' });
  });

  it('uses alt names, ignores old names and weak matches', () => {
    expect(osmNames(node(1, 0, 0, { name: 'A', alt_name: 'B;C', old_name: 'D' }))).toEqual(['A', 'B', 'C']);
    const m = matchPins(
      [T('la-poutinerie', 'epcot', ['La Poutinerie']), T('pecos-bill-tall-tale-inn-and-cafe', 'magic-kingdom', ['Pecos Bill Tall Tale Inn and Cafe', 'Pecos Bill'])],
      [
        node(1, 28.3717, -81.5463, { amenity: 'fast_food', name: 'Refreshment Port', old_name: 'La Poutinerie' }),
        node(2, 28.41865, -81.58395, { amenity: 'restaurant', name: 'Pecos Bill Tall Tale Inn & Cafe' }),
        node(3, 28.4187, -81.5841, { amenity: 'restaurant', name: 'Bill’s Snacks' }),
      ],
    );
    expect(m.map((x) => [x.id, x.osm_id])).toEqual([['pecos-bill-tall-tale-inn-and-cafe', 'node/2']]);
  });

  it('breaks equal scores by distance to the estimate', () => {
    const m = matchPins(
      [T('casey-s-corner', 'magic-kingdom', ["Casey's Corner"], 28.41755, -81.5816)],
      [
        node(1, 28.4200, -81.5790, { amenity: 'fast_food', name: "Casey's Corner" }),
        node(2, 28.41760, -81.58155, { amenity: 'fast_food', name: "Casey's Corner" }),
      ],
    );
    expect(m[0].osm_id).toBe('node/2');
  });

  it('builds an Overpass query over the WDW box', () => {
    const q = overpassQuery(WDW_BBOX);
    expect(q).toContain('(28.33,-81.62,28.43,-81.5)');
    expect(q).toContain('out center tags;');
  });
});
