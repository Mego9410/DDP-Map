import { badgeFor, type Badge } from '../logic/credits';
import type { ItemSection, Location, MenuItem, Theme } from '../shared/types';
import { themeStyle } from './textures';

const SECTIONS: { id: ItemSection; title: string }[] = [
  { id: 'entree', title: 'Entrées' },
  { id: 'kids', title: 'Kids’ meals' },
  { id: 'snack', title: 'Snacks, sides & desserts' },
  { id: 'drink', title: 'Drinks' },
];

export function CreditBadge({ badge }: { badge: Badge }) {
  return <span className={`badge badge--${badge.kind}`}>{badge.label}</span>;
}

function price(p: number | null): string {
  return p == null ? 'Price n/a' : `$${p.toFixed(2)}`;
}

export function Menu({
  location,
  items,
  theme,
  logo,
  editing,
  onEditItem,
  onAddItem,
}: {
  location: Location;
  items: MenuItem[];
  theme: Theme;
  logo: React.ReactNode;
  editing: boolean;
  onEditItem: (item: MenuItem) => void;
  onAddItem: (section: ItemSection) => void;
}) {
  const t = theme.tokens;
  return (
    <article
      className={`menu menu--${t.layout} price--${t.priceStyle}${t.texture === 'none' ? '' : ' has-texture'}`}
      style={themeStyle(t)}
      data-theme={theme.id}
      aria-label={`${location.name} menu`}
    >
      <header className="menu-head">
        {logo}
        <div>
          <h3 className="menu-title">{location.name}</h3>
          <p className="menu-sub">
            Menu as of {location.menu_as_of ? formatDate(location.menu_as_of) : 'unknown date'}
          </p>
        </div>
      </header>
      {SECTIONS.map((s) => {
        const rows = items.filter((i) => i.section === s.id);
        if (!rows.length && !editing) return null;
        return (
          <section key={s.id} className="menu-section">
            <h4 className="menu-h">{s.title}</h4>
            <ul>
              {rows.map((i) => {
                const b = badgeFor(location, i);
                const body = (
                  <>
                    <span className="mi-line">
                      <span className="mi-name">{i.name}</span>
                      <span className="mi-leader" aria-hidden="true" />
                      <span className="mi-price">{price(i.price_usd)}</span>
                    </span>
                    <span className="mi-meta">
                      <CreditBadge badge={b} />
                      {i.seasonal && <span className="mi-tag">seasonal</span>}
                      {i.note && <span className="mi-note">{i.note}</span>}
                    </span>
                  </>
                );
                return (
                  <li key={i.id} className="mi">
                    {editing ? (
                      <button type="button" className="mi-edit" onClick={() => onEditItem(i)} aria-label={`Edit ${i.name}`}>
                        {body}
                      </button>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
            {editing && (
              <button type="button" className="menu-add" onClick={() => onAddItem(s.id)}>
                + Add to {s.title.toLowerCase()}
              </button>
            )}
          </section>
        );
      })}
      {!items.length && !editing && <p className="menu-empty">No menu saved for this place yet.</p>}
    </article>
  );
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
