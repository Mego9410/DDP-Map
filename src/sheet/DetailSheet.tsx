import { useState } from 'react';
import { EditItem, blankItem } from '../admin/EditItem';
import { EditLocation, ImageButtons } from '../admin/EditLocation';
import { toggleStar, toggleVisited } from '../data/actions';
import { useFamilyNames, useFavourites, useLocation, useMenu, useTheme } from '../data/hooks';
import { useSession } from '../data/session';
import { CREDIT_LABEL } from '../logic/credits';
import { formatWalk, haversine } from '../logic/distance';
import type { ItemSection, MenuItem } from '../shared/types';
import { useUi } from '../store';
import { Hero, Logo } from './Hero';
import { Menu, formatDate } from './Menu';

const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' } as const;

export function DetailHeader({ id }: { id: string }) {
  const loc = useLocation(id);
  const select = useUi((s) => s.select);
  return (
    <div className="detail-head">
      <button type="button" className="icon-btn" aria-label="Back to list" onClick={() => select(null)}>
        ←
      </button>
      <h2 className="detail-title">{loc?.name ?? ''}</h2>
    </div>
  );
}

export function DetailSheet({ id }: { id: string }) {
  const loc = useLocation(id);
  const items = useMenu(id);
  const theme = useTheme(loc?.theme_id);
  const favs = useFavourites();
  const names = useFamilyNames();
  const user = useSession((s) => s.user);
  const { pos, editMode, set } = useUi();
  const [editing, setEditing] = useState<{ item: Omit<MenuItem, 'updated_at'>; isNew: boolean } | null>(null);
  const [editingLoc, setEditingLoc] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  if (!loc) return <p className="inline-msg">Loading…</p>;

  const mine = favs.find((f) => f.location_id === id && f.user_email === user?.email);
  const others = favs.filter((f) => f.location_id === id && f.user_email !== user?.email && f.starred);
  const metres = pos && loc.lat != null && loc.lng != null ? haversine(pos, { lng: loc.lng, lat: loc.lat }) : null;
  const admin = user?.role === 'admin' && editMode;

  const addItem = (section: ItemSection) => {
    const sort = items.reduce((m, i) => Math.max(m, i.sort), -1) + 1;
    setEditing({ item: blankItem(loc.id, section, sort), isNew: true });
  };

  return (
    <div className="detail" data-testid="detail">
      <Hero location={loc} theme={theme} />
      <div className="detail-info">
        <p className="detail-area">
          {loc.area_label}
          {metres != null && <> · {formatWalk(metres)}</>}
        </p>
        <p className={`credit-pill credit--${loc.credit}`}>{CREDIT_LABEL[loc.credit]}</p>
        {loc.credit_note && <p className="inline-msg inline-msg--warn">{loc.credit_note}</p>}
        <dl className="facts">
          <div>
            <dt>Meals</dt>
            <dd>{loc.meals.length ? loc.meals.map((m) => MEAL_LABEL[m]).join(', ') : 'Not stated'}</dd>
          </div>
          <div>
            <dt>Hours</dt>
            <dd>{loc.hours ?? 'Check My Disney Experience on the day'}</dd>
          </div>
          <div>
            <dt>Mobile order</dt>
            <dd>{loc.mobile_order == null ? 'Check the app' : loc.mobile_order ? 'Yes' : 'No'}</dd>
          </div>
          {loc.seasonal && (
            <div>
              <dt>Seasonal</dt>
              <dd>Open some seasons only</dd>
            </div>
          )}
        </dl>
        <div className="detail-actions">
          <button type="button" className={`btn btn--toggle${mine?.starred ? ' is-on' : ''}`} aria-pressed={!!mine?.starred} onClick={() => void toggleStar(loc.id)}>
            {mine?.starred ? '★ Starred' : '☆ Star'}
          </button>
          <button type="button" className={`btn btn--toggle${mine?.visited_on ? ' is-on' : ''}`} aria-pressed={!!mine?.visited_on} onClick={() => void toggleVisited(loc.id)}>
            {mine?.visited_on ? `✓ Eaten ${formatDate(mine.visited_on)}` : 'Mark as eaten'}
          </button>
        </div>
        {others.length > 0 && <p className="family-stars">★ Starred by {others.map((f) => names.get(f.user_email) ?? f.user_email.split('@')[0]).join(', ')}</p>}
        {admin && (
          <div className="admin-panel">
            <div className="admin-row">
              <button type="button" className="btn btn--small" onClick={() => setEditingLoc(true)}>
                Edit details
              </button>
              <button type="button" className="btn btn--small" onClick={() => set({ moving: { id: loc.id, lng: loc.lng!, lat: loc.lat! }, snap: 'peek' })}>
                Move pin
              </button>
            </div>
            <ImageButtons location={loc} />
            {loc.coord_source === 'approx' && <p className="inline-msg inline-msg--quiet">Pin position is an estimate. Use Move pin to fix it.</p>}
          </div>
        )}
      </div>

      <Menu
        location={loc}
        items={items}
        theme={theme}
        logo={<Logo location={loc} theme={theme} />}
        editing={admin}
        onEditItem={(item) => setEditing({ item, isNew: false })}
        onAddItem={addItem}
      />

      {loc.notes && (
        <section className="notes">
          <button type="button" className="notes-toggle" aria-expanded={showNotes} onClick={() => setShowNotes(!showNotes)}>
            {showNotes ? 'Hide notes' : 'Notes, drinks and party-night extras'}
          </button>
          {showNotes && (
            <>
              <p>{loc.notes}</p>
              {loc.sources.length > 0 && (
                <p className="sources">
                  Sources:{' '}
                  {loc.sources.map((s, i) => (
                    <span key={s}>
                      {i > 0 && ' · '}
                      <a href={s} target="_blank" rel="noopener noreferrer">
                        {new URL(s).hostname.replace(/^www\./, '')}
                      </a>
                    </span>
                  ))}
                </p>
              )}
            </>
          )}
        </section>
      )}
      <p className="small-print">
        Free ice water at the counter. Prices change often: check the menu board. Menu as of {loc.menu_as_of ? formatDate(loc.menu_as_of) : 'unknown'}.
      </p>

      {editing && <EditItem item={editing.item} isNew={editing.isNew} onClose={() => setEditing(null)} />}
      {editingLoc && <EditLocation location={loc} onClose={() => setEditingLoc(false)} />}
    </div>
  );
}
