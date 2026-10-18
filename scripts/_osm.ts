// Pure helpers for placing restaurant pins from OpenStreetMap data.
// Network code lives in scripts/pins.ts; this file is tested.

import { haversine } from '../src/logic/distance.js';
import { parkForPoint } from '../src/shared/parks.js';
import { nameSimilarity } from './_match.js';

export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface PinTarget {
  id: string;
  park_id: string;
  names: string[];
  /** Current (estimated) position, used to break ties. */
  lat: number | null;
  lng: number | null;
}

export interface PinMatch {
  id: string;
  lat: number;
  lng: number;
  osm_id: string;
  osm_name: string;
  score: number;
}

export function positionOf(e: OsmElement): { lat: number; lng: number } | null {
  const lat = e.lat ?? e.center?.lat;
  const lng = e.lon ?? e.center?.lon;
  return lat == null || lng == null ? null : { lat, lng };
}

/** The names a mapper may have used. `old_name` is left out: renamed places would steal pins. */
export function osmNames(e: OsmElement): string[] {
  const t = e.tags ?? {};
  return [t.name, t['name:en'], t.official_name, t.alt_name, t.short_name]
    .filter((n): n is string => !!n)
    .flatMap((n) => n.split(';').map((x) => x.trim()));
}

/**
 * Assigns OSM features to restaurants. A feature must sit inside the
 * restaurant's park and its name must contain at least `minForward` of the
 * restaurant's distinctive words. Best scores are assigned first and each
 * feature is used once, so near-duplicates ("Connections Café" vs
 * "Connections Eatery") land on the right building.
 */
export function matchPins(targets: PinTarget[], elements: OsmElement[], minForward = 0.67): PinMatch[] {
  const candidates: (PinMatch & { dist: number })[] = [];
  for (const e of elements) {
    const pos = positionOf(e);
    const names = osmNames(e);
    if (!pos || !names.length) continue;
    const park = parkForPoint(pos.lng, pos.lat);
    if (!park) continue;
    for (const t of targets) {
      if (t.park_id !== park) continue;
      let best = { forward: 0, score: 0, name: '' };
      for (const ours of t.names) {
        for (const theirs of names) {
          const s = nameSimilarity(ours, theirs);
          if (s.forward >= minForward && s.score > best.score) best = { ...s, name: theirs };
        }
      }
      if (!best.name) continue;
      const dist = t.lat != null && t.lng != null ? haversine({ lat: t.lat, lng: t.lng }, pos) : 0;
      candidates.push({ id: t.id, lat: pos.lat, lng: pos.lng, osm_id: `${e.type}/${e.id}`, osm_name: best.name, score: Math.round(best.score * 100) / 100, dist });
    }
  }
  // Highest score first; nearer to the estimate breaks ties.
  candidates.sort((a, b) => b.score - a.score || a.dist - b.dist);
  const usedTargets = new Set<string>();
  const usedElements = new Set<string>();
  const out: PinMatch[] = [];
  for (const c of candidates) {
    if (usedTargets.has(c.id) || usedElements.has(c.osm_id)) continue;
    usedTargets.add(c.id);
    usedElements.add(c.osm_id);
    out.push({ id: c.id, lat: c.lat, lng: c.lng, osm_id: c.osm_id, osm_name: c.osm_name, score: c.score });
  }
  return out;
}

export function overpassQuery(bbox: [number, number, number, number]): string {
  const [west, south, east, north] = bbox;
  const b = `${south},${west},${north},${east}`;
  return `[out:json][timeout:90];
(
  nwr["amenity"~"^(restaurant|fast_food|cafe|ice_cream|food_court|bar|pub)$"](${b});
  nwr["shop"~"^(bakery|coffee|confectionery|pastry)$"](${b});
);
out center tags;`;
}
