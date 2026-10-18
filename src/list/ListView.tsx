import { useVisible } from '../app/useVisible';
import { useFavourites } from '../data/hooks';
import { CREDIT_SHORT } from '../logic/credits';
import { formatWalk, nearest } from '../logic/distance';
import { counterCupRefills } from '../shared/normalize';
import { PARKS } from '../shared/parks';
import { useRefills, useLocations } from '../data/hooks';
import { useUi } from '../store';

export function ListHeader({ onLocate }: { onLocate: () => void }) {
  const { query, set, sort, geo } = useUi();
  return (
    <div className="list-head">
      <label className="search">
        <span className="sr-only">Search restaurants and menus</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
        <input
          type="search"
          placeholder="Search places or dishes, e.g. pizza"
          value={query}
          onChange={(e) => set({ query: e.target.value, snap: 'full' })}
          onFocus={() => set({ snap: 'full' })}
          enterKeyHint="search"
        />
      </label>
      <div className="list-tools">
        <div className="seg" role="group" aria-label="Sort">
          <button type="button" aria-pressed={sort === 'distance'} className={sort === 'distance' ? 'is-on' : ''} onClick={() => { set({ sort: 'distance' }); if (geo !== 'on') onLocate(); }}>
            Nearest
          </button>
          <button type="button" aria-pressed={sort === 'name'} className={sort === 'name' ? 'is-on' : ''} onClick={() => set({ sort: 'name' })}>
            A–Z
          </button>
        </div>
      </div>
    </div>
  );
}

export function ListView({ onLocate }: { onLocate: () => void }) {
  const { inPark, byDistance, email } = useVisible();
  const { parkId, geo, pos, sort, select, fly, selectRefill, showRefills } = useUi();
  const favs = useFavourites();
  const refills = useRefills();
  const locations = useLocations();
  const park = PARKS.find((p) => p.id === parkId)!;
  const mine = new Set(favs.filter((f) => f.user_email === email && f.starred).map((f) => f.location_id));
  const visited = new Set(favs.filter((f) => f.user_email === email && f.visited_on).map((f) => f.location_id));

  const nearestQs = pos ? nearest(pos, locations.filter((l) => l.credit === 'quick_service')) : null;
  const nearestRefill = pos ? nearest(pos, [...refills, ...counterCupRefills(locations)]) : null;

  return (
    <div className="list">
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
        <button type="button" className="near-btn" onClick={onLocate}>
          <span aria-hidden="true">◎</span> Use my location
        </button>
      )}
      {geo === 'asking' && <p className="inline-msg inline-msg--quiet">Finding you…</p>}
      {pos && (
        <div className="near-row">
          {nearestQs && (
            <button
              type="button"
              className="near-btn near-btn--qs"
              onClick={() => {
                select(nearestQs.item.id);
              }}
            >
              Nearest QS · {nearestQs.item.short_name ?? nearestQs.item.name} · {formatWalk(nearestQs.metres)}
            </button>
          )}
          {nearestRefill && (
            <button
              type="button"
              className="near-btn near-btn--refill"
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
              💧 Nearest refill · {formatWalk(nearestRefill.metres)}
            </button>
          )}
        </div>
      )}
      {showRefills && (
        <p className="info-card">
          <strong>Free ice water</strong> at any quick-service counter: just ask for a cup.
        </p>
      )}
      <p className="list-count" aria-live="polite">
        {inPark.length} {inPark.length === 1 ? 'place' : 'places'} in {park.name}
        {byDistance ? ', nearest first' : ''}
      </p>
      <ul className="rows">
        {inPark.map(({ location: l, items, metres }) => (
          <li key={l.id}>
            <button type="button" className="row" onClick={() => select(l.id)}>
              <span className={`row-credit credit--${l.credit}`}>{CREDIT_SHORT[l.credit]}</span>
              <span className="row-main">
                <span className="row-name">
                  {l.name}
                  {mine.has(l.id) && <span className="row-star" aria-label="starred"> ★</span>}
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
              {metres != null && <span className="row-dist">{formatWalk(metres)}</span>}
            </button>
          </li>
        ))}
      </ul>
      {!inPark.length && <p className="inline-msg">Nothing matches. Clear a filter or the search.</p>}
    </div>
  );
}
