import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { Protocol } from 'pmtiles';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useVisible } from '../app/useVisible';
import { useFavourites, useRefills } from '../data/hooks';
import { PARKS } from '../shared/parks';
import { useUi } from '../store';
import { PinManager, SimpleMarkers, type PinData } from './pins';
import { buildStyle, MAX_BOUNDS } from './style';
import { cacheExtract, hasPmtiles } from './tiles';

let protocolAdded = false;
const LONG_PRESS_MS = 650;

export function MapView() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pinsRef = useRef<PinManager | null>(null);
  const refillsRef = useRef<SimpleMarkers | null>(null);
  const meRef = useRef<SimpleMarkers | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState(false);

  const ui = useUi();
  const { all, email } = useVisible();
  const favs = useFavourites();
  const refills = useRefills();

  // --- create the map once ------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!protocolAdded) {
        // MapLibre 6 ships its worker as a separate module; Vite emits it as an asset
        // (precached by the service worker like the rest of the app).
        maplibregl.setWorkerUrl(workerUrl);
        maplibregl.addProtocol('pmtiles', new Protocol().tile);
        protocolAdded = true;
      }
      const vector = await hasPmtiles();
      if (cancelled || !container.current) return;
      const park = PARKS.find((p) => p.id === useUi.getState().parkId) ?? PARKS[0];
      let map: maplibregl.Map;
      try {
        map = new maplibregl.Map({
          container: container.current,
          style: buildStyle(vector),
          center: [park.center_lng, park.center_lat],
          zoom: park.default_zoom,
          minZoom: 11,
          maxZoom: 19.5,
          maxBounds: MAX_BOUNDS,
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
        });
      } catch {
        setError('This browser can’t draw the map (WebGL is off). The list below still works.');
        return;
      }
      map.touchZoomRotate.disableRotation();
      if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __map: maplibregl.Map }).__map = map;
      mapRef.current = map;
      pinsRef.current = new PinManager(map, (id) => useUi.getState().select(id));
      refillsRef.current = new SimpleMarkers(map);
      meRef.current = new SimpleMarkers(map);

      const onView = () => {
        pinsRef.current?.render();
        setLabels(map.getZoom() >= 16.3);
      };
      map.on('moveend', onView);
      map.on('zoomend', onView);
      map.on('click', () => {
        const s = useUi.getState();
        if (s.moving) return;
        if (s.selectedId || s.selectedRefillId) s.set({ selectedId: null, selectedRefillId: null, snap: 'peek' });
      });
      map.on('load', () => {
        setReady(true);
        onView();
        if (vector) void cacheExtract().catch(() => {});
      });
    })();
    return () => {
      cancelled = true;
      pinsRef.current?.destroy();
      refillsRef.current?.destroy();
      meRef.current?.destroy();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // --- long-press to add a refill point (admin edit mode) -----------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !ui.editMode) return;
    const canvas = map.getCanvasContainer();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let start: { x: number; y: number } | null = null;
    const fire = (x: number, y: number) => {
      const rect = canvas.getBoundingClientRect();
      const ll = map.unproject([x - rect.left, y - rect.top]);
      useUi.getState().set({ addingRefill: { lng: ll.lng, lat: ll.lat }, selectedId: null, selectedRefillId: null, snap: 'half' });
    };
    const down = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY };
      timer = setTimeout(() => start && fire(start.x, start.y), LONG_PRESS_MS);
    };
    const move = (e: TouchEvent) => {
      const t = e.touches[0];
      if (start && t && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10 && timer) clearTimeout(timer);
    };
    const up = () => timer && clearTimeout(timer);
    const ctx = (e: MouseEvent) => {
      e.preventDefault();
      fire(e.clientX, e.clientY);
    };
    canvas.addEventListener('touchstart', down, { passive: true });
    canvas.addEventListener('touchmove', move, { passive: true });
    canvas.addEventListener('touchend', up);
    canvas.addEventListener('contextmenu', ctx);
    return () => {
      up();
      canvas.removeEventListener('touchstart', down);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', up);
      canvas.removeEventListener('contextmenu', ctx);
    };
  }, [ready, ui.editMode]);

  // --- restaurant pins ----------------------------------------------------
  const pins = useMemo<PinData[]>(() => {
    const mine = new Set(favs.filter((f) => f.user_email === email && f.starred).map((f) => f.location_id));
    const visited = new Set(favs.filter((f) => f.user_email === email && f.visited_on).map((f) => f.location_id));
    const family = new Set(favs.filter((f) => f.user_email !== email && f.starred).map((f) => f.location_id));
    return all
      .filter((r) => r.location.lng != null && r.location.lat != null)
      .map(({ location: l }) => {
        const moving = ui.moving?.id === l.id ? ui.moving : null;
        return {
          id: l.id,
          lng: moving?.lng ?? l.lng!,
          lat: moving?.lat ?? l.lat!,
          credit: l.credit,
          label: l.short_name ?? l.name,
          name: l.name,
          starred: mine.has(l.id),
          familyStarred: family.has(l.id),
          visited: visited.has(l.id),
          selected: ui.selectedId === l.id,
          cup: ui.showRefills && l.credit === 'quick_service',
          approx: l.coord_source === 'approx',
        };
      });
    // `moving` changes on every drag frame; maplibre moves the marker itself then.
  }, [all, favs, email, ui.selectedId, ui.showRefills, ui.moving?.id]);

  useEffect(() => {
    if (ready) pinsRef.current?.setData(pins);
  }, [ready, pins]);

  useEffect(() => {
    if (!ready) return;
    pinsRef.current?.setDraggable(ui.moving?.id ?? null, (lng, lat) => {
      const m = useUi.getState().moving;
      if (m) useUi.getState().set({ moving: { ...m, lng, lat } });
    });
  }, [ready, ui.moving?.id, pins]);

  // --- refill points --------------------------------------------------------
  useEffect(() => {
    if (!ready) return;
    const shown = ui.showRefills ? refills : [];
    refillsRef.current?.sync(
      shown,
      (r) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = `refill-pin refill-pin--${r.kind}${ui.selectedRefillId === r.id ? ' is-selected' : ''}`;
        el.setAttribute('aria-label', r.kind === 'bottle_filler' ? 'Bottle filler' : 'Drinking fountain');
        el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c-.3 0-.6.2-.8.5C8.6 7 5.5 11 5.5 14.6a6.5 6.5 0 0 0 13 0C18.5 11 15.4 7 12.8 3c-.2-.3-.5-.5-.8-.5Z"/></svg>';
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          useUi.getState().selectRefill(r.id);
        });
        return el;
      },
      (r) => `${r.id}:${ui.selectedRefillId === r.id}:${r.kind}`,
    );
  }, [ready, refills, ui.showRefills, ui.selectedRefillId]);

  // --- blue dot -----------------------------------------------------------
  useEffect(() => {
    if (!ready) return;
    meRef.current?.sync(ui.pos ? [{ id: 'me', lng: ui.pos.lng, lat: ui.pos.lat }] : [], () => {
      const el = document.createElement('div');
      el.className = 'me-dot';
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', 'You are here');
      return el;
    });
  }, [ready, ui.pos]);

  // --- satellite toggle ---------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (map.getLayer('satellite')) map.setLayoutProperty('satellite', 'visibility', ui.satellite ? 'visible' : 'none');
  }, [ready, ui.satellite]);

  // --- camera -------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !ui.flyTo) return;
    map.flyTo({ center: [ui.flyTo.lng, ui.flyTo.lat], zoom: ui.flyTo.zoom ?? Math.max(map.getZoom(), 16), speed: 1.6, essential: true });
  }, [ready, ui.flyTo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !ui.selectedId) return;
    const p = pins.find((x) => x.id === ui.selectedId);
    if (!p) return;
    // Sit the pin in the visible strip between the top bar and the half-height sheet
    // (the pin is drawn above its point, hence the extra 24px).
    const vh = window.innerHeight;
    const top = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 110;
    const bottom = vh * (1 - 0.55);
    const offsetY = (top + bottom) / 2 + 24 - vh / 2;
    map.easeTo({ center: [p.lng, p.lat], offset: [0, offsetY], zoom: Math.max(map.getZoom(), 16), duration: 450 });
    // Only when the selection changes, not on every data refresh.
  }, [ready, ui.selectedId]);

  return (
    <div className={`map-wrap${labels ? ' show-labels' : ''}${ui.editMode ? ' is-editing' : ''}`}>
      <div ref={container} className="map" data-testid="map" />
      {error && (
        <p className="inline-msg inline-msg--map" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
