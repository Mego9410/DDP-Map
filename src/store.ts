import { create } from 'zustand';
import type { CreditFilter } from './logic/credits';
import { PARKS } from './shared/parks';

export type SheetSnap = 'peek' | 'half' | 'full';
export type GeoStatus = 'off' | 'asking' | 'on' | 'denied' | 'unavailable';
export type SortMode = 'distance' | 'name';

export interface Pos {
  lng: number;
  lat: number;
  accuracy: number;
}

interface UiState {
  parkId: string;
  filters: Set<CreditFilter>;
  showRefills: boolean;
  starredOnly: boolean;
  satellite: boolean;
  query: string;
  sort: SortMode;
  selectedId: string | null;
  selectedRefillId: string | null;
  snap: SheetSnap;
  editMode: boolean;
  menuOpen: boolean;
  pos: Pos | null;
  geo: GeoStatus;
  /** Admin: pin being dragged, with its unsaved position. */
  moving: { id: string; lng: number; lat: number } | null;
  /** Admin: long-press location for a new refill point. */
  addingRefill: { lng: number; lat: number } | null;
  /** Bumped to ask the map to fly somewhere. */
  flyTo: { lng: number; lat: number; zoom?: number; key: number } | null;

  setPark: (id: string) => void;
  toggleFilter: (f: CreditFilter) => void;
  set: (p: Partial<UiState>) => void;
  select: (id: string | null) => void;
  selectRefill: (id: string | null) => void;
  fly: (lng: number, lat: number, zoom?: number) => void;
}

const PREFS_KEY = 'park-plate:prefs';

function loadPrefs(): Partial<UiState> {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as { parkId?: string; filters?: CreditFilter[]; showRefills?: boolean; satellite?: boolean; sort?: SortMode };
    return {
      parkId: PARKS.some((x) => x.id === p.parkId) ? p.parkId : undefined,
      filters: Array.isArray(p.filters) ? new Set(p.filters) : undefined,
      showRefills: typeof p.showRefills === 'boolean' ? p.showRefills : undefined,
      satellite: typeof p.satellite === 'boolean' ? p.satellite : undefined,
      sort: p.sort === 'name' || p.sort === 'distance' ? p.sort : undefined,
    };
  } catch {
    return {};
  }
}

function deepLinkId(): string | null {
  const m = /^#\/l\/([a-z0-9-]+)$/.exec(typeof location === 'undefined' ? '' : location.hash);
  return m ? m[1] : null;
}

const prefs = Object.fromEntries(Object.entries(loadPrefs()).filter(([, v]) => v !== undefined));

export const useUi = create<UiState>((set, get) => ({
  parkId: 'magic-kingdom',
  filters: new Set(),
  showRefills: false,
  starredOnly: false,
  satellite: false,
  query: '',
  sort: 'distance',
  selectedId: deepLinkId(),
  selectedRefillId: null,
  snap: deepLinkId() ? 'half' : 'peek',
  editMode: false,
  menuOpen: false,
  pos: null,
  geo: 'off',
  moving: null,
  addingRefill: null,
  flyTo: null,
  ...prefs,

  setPark: (id) => {
    const park = PARKS.find((p) => p.id === id);
    set({ parkId: id, selectedId: null, selectedRefillId: null, moving: null });
    if (park) get().fly(park.center_lng, park.center_lat, park.default_zoom);
  },
  toggleFilter: (f) => {
    const next = new Set(get().filters);
    if (next.has(f)) next.delete(f);
    else next.add(f);
    set({ filters: next });
  },
  set: (p) => set(p),
  select: (id) => {
    set({ selectedId: id, selectedRefillId: null, moving: null, snap: id ? 'half' : get().snap === 'full' ? 'half' : get().snap });
    const hash = id ? `#/l/${id}` : ' ';
    try {
      history.replaceState(null, '', hash === ' ' ? location.pathname + location.search : hash);
    } catch {
      // ignore (tests / sandboxed iframes)
    }
  },
  selectRefill: (id) => set({ selectedRefillId: id, selectedId: null, moving: null, snap: id ? 'half' : 'peek' }),
  fly: (lng, lat, zoom) => set({ flyTo: { lng, lat, zoom, key: Date.now() + Math.random() } }),
}));

useUi.subscribe((s) => {
  try {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ parkId: s.parkId, filters: [...s.filters], showRefills: s.showRefills, satellite: s.satellite, sort: s.sort }),
    );
  } catch {
    // private mode
  }
});
