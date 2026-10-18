import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LOCAL_ONLY } from '../config';
import { api } from '../data/api';
import { useMediaUrl } from '../data/hooks';
import { luminance } from '../shared/themes';
import type { Location, Theme } from '../shared/types';
import { themeStyle } from './textures';

type GooglePhoto = { photoUri: string; attributions: { name: string; uri: string | null }[] };
// In memory only: Google's terms don't allow storing these photos.
const googleCache = new Map<string, GooglePhoto[]>();

function useGooglePhotos(loc: Location): GooglePhoto[] {
  const [photos, setPhotos] = useState<GooglePhoto[]>(() => googleCache.get(loc.id) ?? []);
  useEffect(() => {
    if (LOCAL_ONLY || !loc.google_place_id || !navigator.onLine) return;
    const hit = googleCache.get(loc.id);
    if (hit) {
      setPhotos(hit);
      return;
    }
    let live = true;
    api
      .placesPhotos(loc.id)
      .then((r) => {
        googleCache.set(loc.id, r.photos);
        if (live) setPhotos(r.photos);
      })
      .catch(() => googleCache.set(loc.id, []));
    return () => {
      live = false;
    };
  }, [loc.id, loc.google_place_id]);
  return photos;
}

interface StoredSlide {
  kind: 'stored';
  path: string;
  credit: string | null;
  source: string | null;
}
interface GoogleSlide {
  kind: 'google';
  photo: GooglePhoto;
}
type Slide = StoredSlide | GoogleSlide;

function StoredImage({ slide, alt }: { slide: StoredSlide; alt: string }) {
  const src = useMediaUrl(slide.path);
  return src ? <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" /> : null;
}

function Credit({ slide }: { slide: Slide }) {
  if (slide.kind === 'google') {
    return (
      <figcaption className="hero-credit">
        Photo:{' '}
        {slide.photo.attributions.map((a, i) => (
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
    );
  }
  if (!slide.credit) return null;
  return (
    <figcaption className="hero-credit">
      {slide.source ? (
        <a href={slide.source} target="_blank" rel="noopener noreferrer">
          {slide.credit}
        </a>
      ) : (
        slide.credit
      )}
    </figcaption>
  );
}

export function Hero({ location, theme, children }: { location: Location; theme: Theme; children?: ReactNode }) {
  const google = useGooglePhotos(location);
  const [active, setActive] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const t = theme.tokens;

  // Own photos first (the cover, then the gallery), then live Google ones.
  const stored: StoredSlide[] = [];
  if (location.hero_path) stored.push({ kind: 'stored', path: location.hero_path, credit: location.hero_attribution, source: null });
  for (const p of location.photos ?? []) {
    if (p.path !== location.hero_path) stored.push({ kind: 'stored', path: p.path, credit: p.attribution, source: p.source_url });
    else if (stored[0] && !stored[0].source) stored[0].source = p.source_url;
  }
  const slides: Slide[] = [...stored, ...google.map((photo) => ({ kind: 'google' as const, photo }))];

  useEffect(() => {
    setActive(0);
    track.current?.scrollTo({ left: 0 });
  }, [location.id]);

  const onScroll = () => {
    const el = track.current;
    if (el) setActive(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  };

  if (slides.length) {
    return (
      <figure className="hero hero--photos">
        <div className="hero-track" ref={track} onScroll={onScroll}>
          {slides.map((s, i) => (
            <div className="hero-slide" key={s.kind === 'google' ? `g${i}` : s.path}>
              {s.kind === 'google' ? (
                <img src={s.photo.photoUri} alt={`${location.name}, photo ${i + 1}`} loading="lazy" referrerPolicy="no-referrer" />
              ) : (
                <StoredImage slide={s} alt={`${location.name}, photo ${i + 1}`} />
              )}
            </div>
          ))}
        </div>
        <span className="hero-fade" aria-hidden="true" />
        {children}
        <Credit slide={slides[Math.min(active, slides.length - 1)]} />
        {slides.length > 1 && (
          <div className="hero-dots" aria-label={`Photo ${active + 1} of ${slides.length}`} role="img">
            {slides.map((_, i) => (
              <span key={i} className={i === active ? 'is-on' : ''} />
            ))}
          </div>
        )}
      </figure>
    );
  }

  // Themed artwork until a photo exists. Paper-coloured themes would read as
  // grey under the night fade, so they are painted in the theme's accent.
  const light = luminance(t.bg) > 0.45;
  const base = light ? t.accent : t.bg;
  const glow = light ? t.bg : t.accent;
  return (
    <figure className="hero hero--placeholder" style={{ ...themeStyle(t), backgroundColor: base }}>
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
      <span className="hero-fade" aria-hidden="true" />
      {children}
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
