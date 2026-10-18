import type { Park } from './types.js';

export const PARKS: Park[] = [
  { id: 'magic-kingdom', name: 'Magic Kingdom', short_name: 'MK', center_lat: 28.4190, center_lng: -81.5815, default_zoom: 15.6 },
  { id: 'epcot', name: 'EPCOT', short_name: 'EPCOT', center_lat: 28.3705, center_lng: -81.5492, default_zoom: 14.8 },
  { id: 'hollywood-studios', name: 'Hollywood Studios', short_name: 'HS', center_lat: 28.3570, center_lng: -81.5603, default_zoom: 15.3 },
  { id: 'animal-kingdom', name: 'Animal Kingdom', short_name: 'AK', center_lat: 28.3582, center_lng: -81.5903, default_zoom: 15.3 },
  { id: 'disney-springs', name: 'Disney Springs', short_name: 'DS', center_lat: 28.3706, center_lng: -81.5165, default_zoom: 15.2 },
];

/** Seed file park names to ids. */
export const PARK_ID_BY_NAME: Record<string, string> = {
  'Magic Kingdom': 'magic-kingdom',
  EPCOT: 'epcot',
  'Hollywood Studios': 'hollywood-studios',
  'Animal Kingdom': 'animal-kingdom',
  'Disney Springs': 'disney-springs',
};

/** Rough park outlines (lng, lat rings) for assigning OSM refill points to a park. */
export const PARK_OUTLINES: Record<string, [number, number][]> = {
  'magic-kingdom': [[-81.5875, 28.4145], [-81.5755, 28.4145], [-81.5755, 28.4245], [-81.5875, 28.4245]],
  epcot: [[-81.5565, 28.3625], [-81.5415, 28.3625], [-81.5415, 28.3775], [-81.5565, 28.3775]],
  'hollywood-studios': [[-81.5665, 28.3505], [-81.5545, 28.3505], [-81.5545, 28.3625], [-81.5665, 28.3625]],
  'animal-kingdom': [[-81.5990, 28.3515], [-81.5825, 28.3515], [-81.5825, 28.3665], [-81.5990, 28.3665]],
  'disney-springs': [[-81.5255, 28.3655], [-81.5075, 28.3655], [-81.5075, 28.3745], [-81.5255, 28.3745]],
};

/** WDW bounding box (west, south, east, north), matches the PMTiles extract. */
export const WDW_BBOX: [number, number, number, number] = [-81.62, 28.33, -81.50, 28.43];

export function pointInPolygon(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function parkForPoint(lng: number, lat: number): string | null {
  for (const [id, ring] of Object.entries(PARK_OUTLINES)) {
    if (pointInPolygon(lng, lat, ring)) return id;
  }
  return null;
}
