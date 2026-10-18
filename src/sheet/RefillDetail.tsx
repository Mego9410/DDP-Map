import { useState } from 'react';
import { RefillForm } from '../admin/AddRefill';
import { useRefills } from '../data/hooks';
import { useSession } from '../data/session';
import { formatWalk, haversine } from '../logic/distance';
import { useUi } from '../store';
import { Back, Drop } from '../ui/icons';
import { formatDate } from './Menu';

const KIND = { bottle_filler: 'Bottle filler', fountain: 'Drinking fountain', qs_counter_cup: 'QS counter cup' } as const;

export function RefillDetail({ id }: { id: string }) {
  const r = useRefills().find((x) => x.id === id);
  const { pos, editMode, selectRefill } = useUi();
  const admin = useSession((s) => s.user?.role === 'admin') && editMode;
  const [editing, setEditing] = useState(false);
  if (!r) return null;
  const metres = pos ? haversine(pos, r) : null;
  return (
    <div className="detail refill-detail" data-testid="refill-detail">
      <div className="detail-head">
        <button type="button" className="icon-btn" aria-label="Back to list" onClick={() => selectRefill(null)}>
          <Back size={20} />
        </button>
        <span className="refill-badge">
          <Drop size={18} />
        </span>
        <h2 className="detail-title">{KIND[r.kind]}</h2>
      </div>
      <dl className="facts">
        <div>
          <dt>Where</dt>
          <dd>{r.description ?? 'No description yet'}</dd>
        </div>
        <div>
          <dt>Indoor / outdoor</dt>
          <dd>{r.indoor == null ? 'Not sure' : r.indoor ? 'Indoor' : 'Outdoor'}</dd>
        </div>
        <div>
          <dt>Last confirmed</dt>
          <dd>{r.last_confirmed ? formatDate(r.last_confirmed) : 'Not confirmed yet'}</dd>
        </div>
        {metres != null && (
          <div>
            <dt>Distance</dt>
            <dd>{formatWalk(metres)}</dd>
          </div>
        )}
        {r.osm_id && (
          <div>
            <dt>Source</dt>
            <dd>OpenStreetMap {r.osm_id}</dd>
          </div>
        )}
      </dl>
      <p className="info-card">Any quick-service counter will also give you a free cup of ice water.</p>
      {admin && (
        <button type="button" className="btn btn--small" onClick={() => setEditing(true)}>
          Edit / confirm today
        </button>
      )}
      {editing && <RefillForm refill={r} onClose={() => setEditing(false)} />}
    </div>
  );
}
