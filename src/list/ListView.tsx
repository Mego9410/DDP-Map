import { useVisible, type VisibleRow } from '../app/useVisible';
import { useFavourites, useLocations, useMediaUrl, useRefills, useTheme } from '../data/hooks';
import { useSession } from '../data/session';
import { CREDIT_SHORT } from '../logic/credits';
import { formatWalk, nearest } from '../logic/distance';
import { counterCupRefills } from '../shared/normalize';
import { PARKS } from '../shared/parks';
import type { Location } from '../shared/types';
import { textureImage } from '../sheet/textures';
import { useUi } from '../store';
import { Chevron, Drop, Locate, Search, Star } from '../ui/icons';

function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return 'This morning in';
  if (h < 17) return 'This afternoon in';
  return 'Tonight in';
}

export function ListHeader() {
  const { query, set, parkId } = useUi();
  const user = useSession((s) => s.user);
  const park = PARKS.find((p) => p.id === parkId)!;
  const initial = (user?.name ?? user?.email ?? '?').trim()[0]?.toUpperCase();
  return (
    <div className="list-head">
      <div className="list-title-row">
        <div>
          <p className="eyebrow">{greeting()}</p>
          <h1 className="park-title">{park.name}</h1>
        </div>
        <button type="button" className="avatar" aria-label="Menu" onClick={() => set({ menuOpen: true })}>
          {initial}
        </button>
      </div>
      <label className="search">
        <span className="sr-only">Search restaurants and menus</span>
        <Search size={19} />
        <input
          type="search"
          placeholder="Search places or dishes, e.g. pizza"
          value={query}
          onChange={(e) => set({ query: e.target.value, snap: 'full' })}
          onFocus={() => set({ snap: 'full' })}
          enterKeyHint="search"
        />
      </label>
    </div>
  );
}

function PlaceCard({ location, tag, onOpen }: { location: Location; tag: string; onOpen: () => void }) {
  const theme = useTheme(location.theme_id);
  const photo = useMediaUrl(location.hero_path);
  const t = theme.tokens;
  return (
    <button type="button" className="place-card" onClick={onOpen}>
      <span
        className="place-card-art"
        style={{
          backgroundColor: t.bg,
          backgroundImage: photo ? `url("${photo}")` : `radial-gradient(120% 90% at 20% 10%, ${t.accent}66, transparent 60%), ${textureImage(t.texture, t)}`,
        }}
        aria-hidden="true"
      >
        {!photo && (
          <span className="place-card-mark" style={{ fontFamily: t.displayFont, color: t.ink }}>
            {location.short_name ?? location.name}
          </span>
        )}
        <span className="place-card-tag">{tag}</span>
      </span>
      <span className="place-card-body">
        <span className="place-card-name">{location.short_name ?? location.name}</span>
        <span className="place-card-sub">
          {location.area_label} · {location.credit === 'quick_service' ? '1 QS credit' : location.credit === 'snack' ? 'Snack credit' : 'Not on plan'}
        </span>
      </span>
    </button>
  );
}

function pickCards(rows: VisibleRow[], starred: Set<string>, family: Set<string>, byDistance: boolean) {
  const picks: { row: VisibleRow; tag: string }[] = [];
  const seen = new Set<string>();
  const add = (row: VisibleRow, tag: string) => {
    if (seen.has(row.location.id) || picks.length >= 6) return;
    seen.add(row.location.id);
    picks.push({ row, tag });
  };
  if (byDistance && rows[0]?.metres != null) add(rows[0], `Nearest · ${formatWalk(rows[0].metres).replace(' walk', '')}`);
  for (const r of rows) if (starred.has(r.location.id)) add(r, 'Your star');
  for (const r of rows) if (family.has(r.location.id)) add(r, 'Family pick');
  for (const r of rows) if (r.metres != null && byDistance) add(r, formatWalk(r.metres).replace(' walk', ''));
  if (!picks.length) for (const r of rows) if (r.location.credit === 'quick_service') add(r, r.location.area_label);
  return picks;
}

export function ListView({ onLocate }: { onLocate: () => void }) {
  const { inPark, byDistance, email } = useVisible();
  const { parkId, geo, pos, sort, select, fly, selectRefill, showRefills, query, set } = useUi();
  const favs = useFavourites();
  const refills = useRefills();
  const locations = useLocations();
  const park = PARKS.find((p) => p.id === parkId)!;
  const mine = new Set(favs.filter((f) => f.user_email === email && f.starred).map((f) => f.location_id));
  const family = new Set(favs.filter((f) => f.user_email !== email && f.starred).map((f) => f.location_id));
  const visited = new Set(favs.filter((f) => f.user_email === email && f.visited_on).map((f) => f.location_id));

  const nearestQs = pos ? nearest(pos, locations.filter((l) => l.credit === 'quick_service')) : null;
  const nearestRefill = pos ? nearest(pos, [...refills, ...counterCupRefills(locations)]) : null;
  const cards = query ? [] : pickCards(inPark, mine, family, byDistance);

  return (
    <div className="list">
      <div className="list-tools">
        <div className="seg" role="group" aria-label="Sort">
          <button
            type="button"
            aria-pressed={sort === 'distance'}
            className={sort === 'distance' ? 'is-on' : ''}
            onClick={() => {
              set({ sort: 'distance' });
              if (geo !== 'on') onLocate();
            }}
          >
            Nearest
          </button>
          <button type="button" aria-pressed={sort === 'name'} className={sort === 'name' ? 'is-on' : ''} onClick={() => set({ sort: 'name' })}>
            A–Z
          </button>
        </div>
      </div>
      {geo === 'denied' && sort === 'distance' && (
        <p className="inline-msg" role="status">
          Location is off. Turn it on to sort by distance.
        </p>
      )}
      {geo === 'unavailable' && sort === 'distance' && (
        <p className="inline-msg" role="status">
          Can’t find your location right now. Sorted A–Z instead.
        </p>
      )}
      {geo !== 'on' && geo !== 'denied' && geo !== 'asking' && (
        <button type="button" className="locate-btn" onClick={onLocate}>
          <Locate size={18} /> Use my location
        </button>
      )}
      {geo === 'asking' && <p className="inline-msg inline-msg--quiet">Finding you…</p>}

      {pos && (nearestQs || nearestRefill) && (
        <div className="quick-row">
          {nearestQs && (
            <button type="button" className="quick quick--qs" onClick={() => select(nearestQs.item.id)}>
              <span className="quick-k">Nearest QS</span>
              <span className="quick-v">
                {nearestQs.item.short_name ?? nearestQs.item.name} · {formatWalk(nearestQs.metres)}
              </span>
            </button>
          )}
          {nearestRefill && (
            <button
              type="button"
              className="quick quick--water"
              aria-label={`Nearest refill · ${formatWalk(nearestRefill.metres)}`}
              onClick={() => {
                const r = nearestRefill.item;
                if (r.kind === 'qs_counter_cup') select(r.id.replace(/^cup:/, ''));
                else {
                  useUi.getState().set({ showRefills: true });
                  selectRefill(r.id);
                  fly(r.lng, r.lat, 17);
                }
              }}
            >
              <span className="quick-k">
                <Drop size={12} /> Nearest refill
              </span>
              <span className="quick-v">{formatWalk(nearestRefill.metres)}</span>
            </button>
          )}
        </div>
      )}

      {showRefills && (
        <p className="info-card">
          <Drop size={16} />
          <span>
            <strong>Free ice water</strong> at any quick-service counter. Just ask for a cup.
          </span>
        </p>
      )}

      {cards.length > 0 && (
        <section className="cards-section" aria-label="Picks">
          <h2 className="section-h">For you</h2>
          <div className="cards">
            {cards.map(({ row, tag }) => (
              <PlaceCard key={row.location.id} location={row.location} tag={tag} onOpen={() => select(row.location.id)} />
            ))}
          </div>
        </section>
      )}

      <h2 className="section-h" aria-live="polite">
        All places{' '}
        <span className="section-count">
          {inPark.length} in {park.short_name}
          {byDistance ? ' · nearest first' : ''}
        </span>
      </h2>
      <ul className="rows">
        {inPark.map(({ location: l, items, metres }) => (
          <li key={l.id}>
            <button type="button" className="row" onClick={() => select(l.id)}>
              <span className={`row-credit tile--${l.credit}`}>{CREDIT_SHORT[l.credit]}</span>
              <span className="row-main">
                <span className="row-name">
                  {l.name}
                  {mine.has(l.id) && (
                    <span className="row-star" aria-label="starred">
                      {' '}
                      <Star size={13} filled />
                    </span>
                  )}
                  {visited.has(l.id) && <span className="row-done" aria-label="eaten here"> ✓</span>}
                </span>
                <span className="row-sub">
                  {l.area_label}
                  {l.credit_note ? ' · confirm credit at counter' : ''}
                  {l.seasonal ? ' · seasonal' : ''}
                </span>
                {items.length > 0 && (
                  <span className="row-match">
                    {items.slice(0, 3).map((i) => i.name).join(' · ')}
                    {items.length > 3 ? ` +${items.length - 3}` : ''}
                  </span>
                )}
              </span>
              {metres != null ? <span className="row-dist">{formatWalk(metres)}</span> : <Chevron size={16} className="row-chev" />}
            </button>
          </li>
        ))}
      </ul>
      {!inPark.length && <p className="inline-msg">Nothing matches. Clear a filter or the search.</p>}
    </div>
  );
}
