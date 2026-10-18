import { CREDIT_LABEL, type CreditFilter } from '../logic/credits';
import { PARKS } from '../shared/parks';
import { useUi } from '../store';

const CHIPS: { id: CreditFilter; label: string; short: string }[] = [
  { id: 'quick_service', label: CREDIT_LABEL.quick_service, short: 'QS credit' },
  { id: 'snack', label: CREDIT_LABEL.snack, short: 'Snack credit' },
  { id: 'none', label: CREDIT_LABEL.none, short: 'Not on plan' },
];

export function FilterBar() {
  const { parkId, setPark, filters, toggleFilter, showRefills, starredOnly, set } = useUi();
  return (
    <header className="topbar">
      <div className="topbar-row">
        <nav className="parks" aria-label="Park">
          {PARKS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`park-chip${p.id === parkId ? ' is-on' : ''}`}
              aria-pressed={p.id === parkId}
              onClick={() => setPark(p.id)}
              title={p.name}
            >
              {p.short_name}
            </button>
          ))}
        </nav>
        <button type="button" className="icon-btn" aria-label="Menu" onClick={() => set({ menuOpen: true })}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>
      <div className="chips" role="group" aria-label="Filter by credit">
        {CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chip chip--${c.id}${filters.has(c.id) ? ' is-on' : ''}`}
            aria-pressed={filters.has(c.id)}
            onClick={() => toggleFilter(c.id)}
            title={c.label}
          >
            <span className={`dot dot--${c.id}`} aria-hidden="true" />
            {c.short}
          </button>
        ))}
        <button
          type="button"
          className={`chip chip--refill${showRefills ? ' is-on' : ''}`}
          aria-pressed={showRefills}
          onClick={() => set({ showRefills: !showRefills })}
        >
          <span aria-hidden="true">💧</span> Refills
        </button>
        <button
          type="button"
          className={`chip chip--star${starredOnly ? ' is-on' : ''}`}
          aria-pressed={starredOnly}
          onClick={() => set({ starredOnly: !starredOnly })}
        >
          <span aria-hidden="true">★</span> Shortlist
        </button>
      </div>
    </header>
  );
}
