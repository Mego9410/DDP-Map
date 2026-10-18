// Downloads every stored photo into the service-worker caches once, in the
// background, so menus open with their photos in airplane mode (US6) and not
// only for places already viewed. Skipped when the phone asks to save data.

import type { Location } from '../shared/types';

const done = new Set<string>();

function pathsOf(locations: Location[]): string[] {
  const out = new Set<string>();
  for (const l of locations) {
    if (l.hero_path) out.add(l.hero_path);
    if (l.logo_path) out.add(l.logo_path);
    for (const p of l.photos ?? []) out.add(p.path);
  }
  return [...out];
}

export async function warmImages(locations: Location[]): Promise<void> {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (!('caches' in window) || !navigator.serviceWorker?.controller || !navigator.onLine || conn?.saveData) return;
  for (const path of pathsOf(locations)) {
    if (done.has(path)) continue;
    const cacheName = path.startsWith('/photos/') ? 'photos' : path.startsWith('/api/media/') ? 'media' : null;
    if (!cacheName) continue;
    const cache = await caches.open(cacheName);
    if (!(await cache.match(path))) {
      try {
        await cache.add(new Request(path, { credentials: 'same-origin' }));
      } catch {
        // offline again or not found; try next launch
        return;
      }
    }
    done.add(path);
  }
}
