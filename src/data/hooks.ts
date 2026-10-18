import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { LOCAL_ONLY } from '../config';
import { THEME_BY_ID } from '../shared/themes';
import type { Favourite, Location, MenuItem, RefillStation, Theme } from '../shared/types';
import { db, getMeta, META } from './db';

const EMPTY: never[] = [];

export function useLocations(): Location[] {
  return useLiveQuery(() => db.locations.toArray(), [], EMPTY);
}

export function useAllItems(): MenuItem[] {
  return useLiveQuery(() => db.menu_items.toArray(), [], EMPTY);
}

export function useMenu(locationId: string | null): MenuItem[] {
  return useLiveQuery(
    async () => (locationId ? (await db.menu_items.where('location_id').equals(locationId).toArray()).sort((a, b) => a.sort - b.sort) : []),
    [locationId],
    EMPTY,
  );
}

export function useLocation(id: string | null): Location | undefined {
  return useLiveQuery(() => (id ? db.locations.get(id) : undefined), [id]);
}

export function useRefills(): RefillStation[] {
  return useLiveQuery(() => db.refill_stations.toArray(), [], EMPTY);
}

export function useFavourites(): Favourite[] {
  return useLiveQuery(() => db.favourites.toArray(), [], EMPTY);
}

export function useLastSync(): string | undefined {
  return useLiveQuery(() => getMeta<string>(META.lastSync), []);
}

export function useSyncError(): string | undefined {
  return useLiveQuery(() => getMeta<string>(META.syncError), []);
}

export function useFamilyNames(): Map<string, string> {
  const fam = useLiveQuery(() => getMeta<{ email: string; name: string | null }[]>(META.family), []);
  return useMemo(() => new Map((fam ?? []).map((f) => [f.email, f.name ?? f.email.split('@')[0]])), [fam]);
}

export function useOutboxCount(): number {
  return useLiveQuery(() => db.outbox.count(), [], 0);
}

/** Built-in themes, overridden by any rows in the themes table. */
export function useTheme(id: string | null | undefined): Theme {
  const override = useLiveQuery(() => (id ? db.themes.get(id) : undefined), [id]);
  return override ?? THEME_BY_ID[id ?? ''] ?? THEME_BY_ID['springs-modern'];
}

/**
 * Resolves an image path to something an <img> can show. In local-only mode
 * images live in IndexedDB; otherwise /api/media/:id is served (and cached
 * by the service worker) directly.
 */
export function useMediaUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const localId = LOCAL_ONLY && path?.startsWith('/api/media/') ? path.slice('/api/media/'.length) : null;
  const blob = useLiveQuery(() => (localId ? db.media.get(localId) : undefined), [localId]);
  useEffect(() => {
    if (!path) return setUrl(null);
    if (!localId) return setUrl(path);
    if (!blob) return setUrl(null);
    const u = URL.createObjectURL(blob.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [path, localId, blob]);
  return url;
}

export function useFavouriteIndex(favs: Favourite[], email: string | undefined) {
  return useMemo(() => {
    const mine = new Map<string, Favourite>();
    const family = new Map<string, string[]>();
    for (const f of favs) {
      if (f.user_email === email) mine.set(f.location_id, f);
      else if (f.starred) family.set(f.location_id, [...(family.get(f.location_id) ?? []), f.user_email]);
    }
    return { mine, family };
  }, [favs, email]);
}
