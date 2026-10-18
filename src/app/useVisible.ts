import { useMemo } from 'react';
import { useAllItems, useFavourites, useLocations } from '../data/hooks';
import { useSession } from '../data/session';
import { matchesCreditFilter, snackSellers } from '../logic/credits';
import { haversine } from '../logic/distance';
import { searchLocations, type SearchHit } from '../logic/search';
import type { Location } from '../shared/types';
import { useUi } from '../store';

export interface VisibleRow extends SearchHit {
  metres: number | null;
}

/**
 * The one place the credit filter, shortlist and search are applied, so the
 * map pins and the list always show the same set.
 */
export function useVisible() {
  const locations = useLocations();
  const items = useAllItems();
  const favs = useFavourites();
  const { filters, starredOnly, query, pos, sort, parkId } = useUi();
  const email = useSession((s) => s.user?.email);

  return useMemo(() => {
    const sells = snackSellers(items);
    const starred = new Set(favs.filter((f) => f.starred).map((f) => f.location_id));
    const filtered: Location[] = locations.filter(
      (l) => matchesCreditFilter(l, filters, sells) && (!starredOnly || starred.has(l.id)),
    );
    const hits = searchLocations(query, filtered, items);
    const rows: VisibleRow[] = hits.map((h) => ({
      ...h,
      metres: pos && h.location.lat != null && h.location.lng != null ? haversine(pos, { lng: h.location.lng, lat: h.location.lat }) : null,
    }));
    const inPark = rows.filter((r) => r.location.park_id === parkId);
    const byDistance = sort === 'distance' && pos != null;
    inPark.sort((a, b) =>
      byDistance && a.metres != null && b.metres != null ? a.metres - b.metres : a.location.name.localeCompare(b.location.name),
    );
    return { all: rows, inPark, sellsSnack: sells, byDistance, email };
  }, [locations, items, favs, filters, starredOnly, query, pos, sort, parkId, email]);
}
