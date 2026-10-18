const R = 6371008.8; // mean Earth radius, metres
export const WALK_M_PER_MIN = 80;

export interface LngLat {
  lng: number;
  lat: number;
}

export function haversine(a: LngLat, b: LngLat): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function walkMinutes(metres: number): number {
  return Math.max(1, Math.round(metres / WALK_M_PER_MIN));
}

export function formatWalk(metres: number): string {
  if (metres > 5000) return `${(metres / 1000).toFixed(0)} km away`;
  return `${walkMinutes(metres)} min walk`;
}

export function nearest<T extends { lng: number | null; lat: number | null }>(
  from: LngLat,
  items: T[],
): { item: T; metres: number } | null {
  let best: { item: T; metres: number } | null = null;
  for (const item of items) {
    if (item.lng == null || item.lat == null) continue;
    const metres = haversine(from, { lng: item.lng, lat: item.lat });
    if (!best || metres < best.metres) best = { item, metres };
  }
  return best;
}
