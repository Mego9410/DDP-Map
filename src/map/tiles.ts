import { PMTiles } from 'pmtiles';
import { getMeta, META, setMeta } from '../data/db';
import { PMTILES_PATH } from './style';

/** True if the WDW extract is deployed (dev servers answer missing files with index.html). */
export async function hasPmtiles(): Promise<boolean> {
  try {
    await new PMTiles(`${location.origin}${PMTILES_PATH}`).getHeader();
    return true;
  } catch {
    return false;
  }
}

const MONTH = 30 * 24 * 60 * 60 * 1000;

/**
 * Stores the whole extract in the service-worker cache (TRD §9) so every
 * zoom level works offline, not just tiles already viewed. Refreshed monthly.
 */
export async function cacheExtract(): Promise<'cached' | 'fresh' | 'unsupported'> {
  if (!('caches' in window) || !navigator.serviceWorker?.controller) return 'unsupported';
  const at = await getMeta<number>(META.tilesCachedAt);
  const cache = await caches.open('pmtiles');
  const url = `${location.origin}${PMTILES_PATH}`;
  if (at && Date.now() - at < MONTH && (await cache.match(url))) return 'fresh';
  if (!navigator.onLine) return 'unsupported';
  await cache.add(new Request(url, { cache: 'reload' }));
  await setMeta(META.tilesCachedAt, Date.now());
  return 'cached';
}
