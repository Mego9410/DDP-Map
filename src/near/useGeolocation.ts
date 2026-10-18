import { useCallback, useEffect, useRef } from 'react';
import { useUi } from '../store';

/**
 * Blue dot + distance sort (TRD §6): watchPosition with high accuracy and a
 * 10 s max age. Starts automatically if permission was already granted;
 * otherwise waits for the user to tap "Use my location".
 */
export function useGeolocation() {
  const watch = useRef<number | null>(null);
  const set = useUi((s) => s.set);

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      set({ geo: 'unavailable' });
      return;
    }
    if (watch.current != null) return;
    set({ geo: 'asking' });
    watch.current = navigator.geolocation.watchPosition(
      (p) => set({ geo: 'on', pos: { lng: p.coords.longitude, lat: p.coords.latitude, accuracy: p.coords.accuracy } }),
      (err) => {
        if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
        watch.current = null;
        set({ geo: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable', pos: null });
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
  }, [set]);

  useEffect(() => {
    let cancelled = false;
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((st) => {
        if (!cancelled && st.state === 'granted') start();
        if (!cancelled && st.state === 'denied') set({ geo: 'denied' });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
      watch.current = null;
    };
  }, [start, set]);

  return start;
}
