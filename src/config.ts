/** true: no API. Data comes from seed/ files and edits stay on this device. */
export const LOCAL_ONLY = import.meta.env.VITE_LOCAL_ONLY === 'true';

export const SATELLITE_URL =
  import.meta.env.VITE_SATELLITE_TILE_URL ||
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const SATELLITE_ATTRIBUTION = import.meta.env.VITE_SATELLITE_TILE_URL
  ? 'Satellite imagery'
  : 'Imagery © Esri, Maxar, Earthstar Geographics';

/** Poll for family changes this often while the app is visible (US5: within a few seconds). */
export const POLL_VISIBLE_MS = 5_000;
/** And this often in the background (TRD §9: every 5 min). */
export const POLL_HIDDEN_MS = 5 * 60_000;

export const LOCAL_USER = { email: 'you@this-device', name: 'You', role: 'admin' as const };
