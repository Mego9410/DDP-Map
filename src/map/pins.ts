// Pins are HTML markers rather than a symbol layer: they need no glyph or
// sprite downloads (so they work offline), and they're real buttons with
// 44px+ tap targets. Clustering when zoomed out past a park (MapLibre zoom
// < 14.5, i.e. Google-style zoom < 15.5) uses supercluster (TRD §6).

import * as maplibregl from 'maplibre-gl';
import Supercluster from 'supercluster';
import type { Credit } from '../shared/types';

export interface PinData {
  id: string;
  lng: number;
  lat: number;
  credit: Credit;
  label: string;
  name: string;
  starred: boolean;
  familyStarred: boolean;
  visited: boolean;
  selected: boolean;
  cup: boolean;
  approx: boolean;
}

const LETTER: Record<Credit, string> = { quick_service: 'QS', snack: 'S', none: '$' };
const CREDIT_WORD: Record<Credit, string> = { quick_service: 'Quick-Service credit', snack: 'Snack credit', none: 'Not on plan' };

type Props = { id: string };

function pinHtml(p: PinData): string {
  const badges = [
    p.starred ? '<span class="pin-badge pin-badge--star" aria-hidden="true">★</span>' : p.familyStarred ? '<span class="pin-badge pin-badge--fam" aria-hidden="true">☆</span>' : '',
    p.visited ? '<span class="pin-badge pin-badge--done" aria-hidden="true">✓</span>' : '',
    p.cup ? '<span class="pin-badge pin-badge--cup" aria-hidden="true">💧</span>' : '',
  ].join('');
  return `<span class="pin-head"><span class="pin-letter">${LETTER[p.credit]}</span>${badges}</span><span class="pin-label">${escapeHtml(p.label)}</span>`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export class PinManager {
  private markers = new Map<string, { marker: maplibregl.Marker; sig: string }>();
  private index: Supercluster<Props> | null = null;
  private data = new Map<string, PinData>();
  private dragging: string | null = null;

  constructor(
    private map: maplibregl.Map,
    private onSelect: (id: string) => void,
  ) {}

  setData(pins: PinData[]): void {
    this.data = new Map(pins.map((p) => [p.id, p]));
    this.index = new Supercluster<Props>({ radius: 52, maxZoom: 14, minPoints: 3 });
    this.index.load(
      pins.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { id: p.id } })),
    );
    this.render();
  }

  render(): void {
    if (!this.index) return;
    const b = this.map.getBounds();
    const zoom = Math.floor(this.map.getZoom());
    const features = this.index.getClusters([b.getWest() - 0.01, b.getSouth() - 0.01, b.getEast() + 0.01, b.getNorth() + 0.01], zoom);
    const seen = new Set<string>();

    for (const f of features) {
      const [lng, lat] = f.geometry.coordinates as [number, number];
      const props = f.properties as Props & { cluster?: boolean; cluster_id?: number; point_count?: number };
      if (props.cluster) {
        const key = `c:${props.cluster_id}`;
        seen.add(key);
        const sig = `${props.point_count}`;
        const cur = this.markers.get(key);
        if (cur && cur.sig === sig) {
          cur.marker.setLngLat([lng, lat]);
          continue;
        }
        cur?.marker.remove();
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'cluster';
        el.textContent = String(props.point_count);
        el.setAttribute('aria-label', `${props.point_count} places here. Zoom in.`);
        const id = props.cluster_id!;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const z = this.index!.getClusterExpansionZoom(id);
          this.map.easeTo({ center: [lng, lat], zoom: Math.max(z, 15.2) });
        });
        this.markers.set(key, { marker: new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(this.map), sig });
        continue;
      }

      const p = this.data.get(props.id);
      if (!p) continue;
      seen.add(p.id);
      const sig = JSON.stringify([p.credit, p.label, p.starred, p.familyStarred, p.visited, p.selected, p.cup]);
      const cur = this.markers.get(p.id);
      if (cur) {
        if (this.dragging !== p.id) cur.marker.setLngLat([p.lng, p.lat]);
        if (cur.sig !== sig) {
          this.paint(cur.marker.getElement() as HTMLButtonElement, p);
          cur.sig = sig;
        }
        continue;
      }
      const el = document.createElement('button');
      el.type = 'button';
      this.paint(el, p);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onSelect(el.dataset.id!);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(this.map);
      this.markers.set(p.id, { marker, sig });
    }

    for (const [key, { marker }] of this.markers) {
      if (!seen.has(key) && key !== this.dragging) {
        marker.remove();
        this.markers.delete(key);
      }
    }
  }

  private paint(el: HTMLButtonElement, p: PinData): void {
    el.dataset.id = p.id;
    el.className = `pin pin--${p.credit}${p.selected ? ' is-selected' : ''}${p.visited ? ' is-visited' : ''}`;
    el.setAttribute('aria-label', `${p.name}, ${CREDIT_WORD[p.credit]}${p.starred ? ', starred' : ''}${p.visited ? ', eaten here' : ''}`);
    el.setAttribute('aria-pressed', String(p.selected));
    el.innerHTML = pinHtml(p);
  }

  /** Admin Move pin: make one marker draggable and report where it lands. */
  setDraggable(id: string | null, onMove?: (lng: number, lat: number) => void): void {
    for (const [key, { marker }] of this.markers) {
      const on = key === id;
      marker.setDraggable(on);
      marker.getElement().classList.toggle('is-dragging', on);
      if (marker.__onDrag) {
        marker.off('drag', marker.__onDrag);
        marker.off('dragend', marker.__onDrag);
        marker.__onDrag = undefined;
      }
      if (on && onMove) {
        const handler = () => {
          const ll = marker.getLngLat();
          onMove(ll.lng, ll.lat);
        };
        marker.__onDrag = handler;
        marker.on('drag', handler);
        marker.on('dragend', handler);
      }
    }
    this.dragging = id;
  }

  destroy(): void {
    for (const { marker } of this.markers.values()) marker.remove();
    this.markers.clear();
  }
}

declare module 'maplibre-gl' {
  interface Marker {
    __onDrag?: () => void;
  }
}

/** Simple, unclustered markers (refill points, the blue dot). */
export class SimpleMarkers {
  private markers = new Map<string, maplibregl.Marker>();
  constructor(private map: maplibregl.Map) {}

  sync<T extends { id: string; lng: number; lat: number }>(items: T[], make: (t: T) => HTMLElement, key: (t: T) => string = (t) => t.id): void {
    const seen = new Set<string>();
    for (const it of items) {
      const k = key(it);
      seen.add(k);
      const cur = this.markers.get(k);
      if (cur) {
        cur.setLngLat([it.lng, it.lat]);
        continue;
      }
      this.markers.set(k, new maplibregl.Marker({ element: make(it) }).setLngLat([it.lng, it.lat]).addTo(this.map));
    }
    for (const [k, m] of this.markers) {
      if (!seen.has(k)) {
        m.remove();
        this.markers.delete(k);
      }
    }
  }

  destroy(): void {
    for (const m of this.markers.values()) m.remove();
    this.markers.clear();
  }
}
