import { useEffect, useState } from 'react';
import { LOCAL_ONLY } from '../config';
import { api } from '../data/api';
import { useMediaUrl } from '../data/hooks';
import type { Location, Theme } from '../shared/types';
import { luminance } from '../shared/themes';
import { themeStyle } from './textures';

type GooglePhoto = { photoUri: string; attributions: { name: string; uri: string | null }[] };
// In-memory only: Google's terms don't allow storing these photos.
const googleCache = new Map<string, GooglePhoto | null>();

function useGooglePhoto(loc: Location): GooglePhoto | null {
  const [photo, setPhoto] = useState<GooglePhoto | null>(() => googleCache.get(loc.id) ?? null);
  useEffect(() => {
    if (LOCAL_ONLY || loc.hero_path || !loc.google_place_id || !navigator.onLine) return;
    if (googleCache.has(loc.id)) {
      setPhoto(googleCache.get(loc.id) ?? null);
      return;
    }
    let live = true;
    api
      .placesPhoto(loc.id)
      .then((p) => {
        googleCache.set(loc.id, p);
        if (live) setPhoto(p);
      })
      .catch(() => googleCache.set(loc.id, null));
    return () => {
      live = false;
    };
  }, [loc.id, loc.hero_path, loc.google_place_id]);
  return photo;
}

export function Hero({ location, theme, children }: { location: Location; theme: Theme; children?: React.ReactNode }) {
  const own = useMediaUrl(location.hero_path);
  const google = useGooglePhoto(location);
  const src = own ?? google?.photoUri ?? null;
  const t = theme.tokens;
  // Paper-coloured themes would read as grey under the night fade, so their
  // artwork is painted in the theme's accent instead of its background.
  const light = luminance(t.bg) > 0.45;
  const base = light ? t.accent : t.bg;
  const glow = light ? t.bg : t.accent;

  return (
    <figure className={`hero${src ? '' : ' hero--placeholder'}`} style={src ? undefined : { ...themeStyle(t), backgroundColor: base }}>
      {src ? (
        <img src={src} alt={`${location.name} storefront`} loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        // Themed artwork until a trip photo is added.
        <span
          className="hero-art"
          aria-hidden="true"
          style={{
            backgroundColor: base,
            backgroundImage: `radial-gradient(110% 80% at 22% 12%, ${glow}${light ? '66' : '88'} 0%, transparent 55%), radial-gradient(90% 70% at 95% 100%, ${t.rule}55 0%, transparent 60%), var(--m-texture)`,
          }}
        >
          <span className="hero-watermark" style={{ fontFamily: t.displayFont }}>
            {location.short_name ?? location.name}
          </span>
        </span>
      )}
      <span className="hero-fade" aria-hidden="true" />
      {children}
      {src && !own && google && (
        <figcaption className="hero-credit">
          Photo:{' '}
          {google.attributions.map((a, i) => (
            <span key={i}>
              {i > 0 && ', '}
              {a.uri ? (
                <a href={a.uri} target="_blank" rel="noopener noreferrer">
                  {a.name}
                </a>
              ) : (
                a.name
              )}
            </span>
          ))}{' '}
          via Google
        </figcaption>
      )}
      {own && location.hero_attribution && <figcaption className="hero-credit">{location.hero_attribution}</figcaption>}
    </figure>
  );
}

export function Logo({ location, theme }: { location: Location; theme: Theme }) {
  const src = useMediaUrl(location.logo_path);
  if (src) return <img className="menu-logo" src={src} alt={`${location.name} logo`} />;
  const initials = (location.short_name ?? location.name)
    .replace(/^the\s+/i, '')
    .split(/[\s'’&-]+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return (
    <span className="menu-logo menu-logo--mark" style={{ fontFamily: theme.tokens.displayFont }} aria-hidden="true">
      {initials}
    </span>
  );
}
