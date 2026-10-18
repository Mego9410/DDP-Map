import { CREDIT_LABEL, type CreditFilter } from '../logic/credits';
import { PARKS } from '../shared/parks';
import { useUi } from '../store';
import { Drop, ParkIcon, Star } from '../ui/icons';

const TAB: Record<string, string> = {
  'magic-kingdom': 'Kingdom',
  epcot: 'EPCOT',
  'hollywood-studios': 'Studios',
  'animal-kingdom': 'Animal',
  'disney-springs': 'Springs',
};

const CHIPS: { id: CreditFilter; label: string; mark: string }[] = [
  { id: 'quick_service', label: 'Quick-Service', mark: 'QS' },
  { id: 'snack', label: 'Snack', mark: 'S' },
  { id: 'none', label: 'Not on plan', mark: '$' },
];

export function FilterBar() {
  const { parkId, setPark, filters, toggleFilter, showRefills, starredOnly, set } = useUi();
  return (
    <header className="topbar">
      <nav className="parks" aria-label="Park">
        {PARKS.map((p) => {
          const Icon = ParkIcon[p.id];
          const on = p.id === parkId;
          return (
            <button
              key={p.id}
              type="button"
              className={`park-tab${on ? ' is-on' : ''}`}
              aria-pressed={on}
              aria-label={p.name}
              onClick={() => setPark(p.id)}
            >
              <Icon size={19} />
              <span>{TAB[p.id]}</span>
            </button>
          );
        })}
      </nav>
      <div className="chips" role="group" aria-label="Filter by credit">
        {CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chip chip--${c.id}${filters.has(c.id) ? ' is-on' : ''}`}
            aria-pressed={filters.has(c.id)}
            aria-label={CREDIT_LABEL[c.id]}
            onClick={() => toggleFilter(c.id)}
          >
            <span className={`chip-mark mark--${c.id}`} aria-hidden="true">
              {c.mark}
            </span>
            {c.label}
          </button>
        ))}
        <button
          type="button"
          className={`chip chip--refill${showRefills ? ' is-on' : ''}`}
          aria-pressed={showRefills}
          onClick={() => set({ showRefills: !showRefills })}
        >
          <span className="chip-icon chip-icon--water">
            <Drop size={14} />
          </span>
          Refills
        </button>
        <button
          type="button"
          className={`chip chip--star${starredOnly ? ' is-on' : ''}`}
          aria-pressed={starredOnly}
          onClick={() => set({ starredOnly: !starredOnly })}
        >
          <span className="chip-icon chip-icon--star">
            <Star size={14} filled />
          </span>
          Shortlist
        </button>
      </div>
    </header>
  );
}
