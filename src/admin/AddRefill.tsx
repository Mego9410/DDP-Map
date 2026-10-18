import { useState } from 'react';
import { deleteRefill, saveRefill } from '../data/actions';
import { randomUuid } from '../shared/ids';
import { parkForPoint } from '../shared/parks';
import type { RefillKind, RefillStation } from '../shared/types';
import { validateRefill } from '../shared/validate';
import { useUi } from '../store';
import { InlineMsg, Modal } from '../ui/Modal';

const today = () => new Date().toISOString().slice(0, 10);

export function RefillForm({ refill, at, onClose }: { refill?: RefillStation; at?: { lng: number; lat: number }; onClose: () => void }) {
  const parkId = useUi((s) => s.parkId);
  const [kind, setKind] = useState<RefillKind>(refill?.kind === 'fountain' ? 'fountain' : 'bottle_filler');
  const [indoor, setIndoor] = useState<boolean | null>(refill?.indoor ?? null);
  const [desc, setDesc] = useState(refill?.description ?? '');
  const [confirmed, setConfirmed] = useState(refill?.last_confirmed ?? today());
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lng = refill?.lng ?? at!.lng;
    const lat = refill?.lat ?? at!.lat;
    const next = {
      id: refill?.id ?? randomUuid(),
      park_id: refill?.park_id ?? parkForPoint(lng, lat) ?? parkId,
      kind,
      lng,
      lat,
      indoor,
      description: desc.trim() || null,
      osm_id: refill?.osm_id ?? null,
      last_confirmed: confirmed || null,
    };
    const err = validateRefill(next);
    if (err) return setError(err);
    await saveRefill(next);
    useUi.getState().set({ showRefills: true });
    onClose();
  };

  return (
    <Modal title={refill ? 'Edit refill point' : 'Add refill here'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="form-row">
          <label>
            Type
            <select value={kind} onChange={(e) => setKind(e.target.value as RefillKind)}>
              <option value="bottle_filler">Bottle filler</option>
              <option value="fountain">Drinking fountain</option>
            </select>
          </label>
          <label>
            Indoor?
            <select value={indoor == null ? 'unknown' : indoor ? 'yes' : 'no'} onChange={(e) => setIndoor(e.target.value === 'unknown' ? null : e.target.value === 'yes')}>
              <option value="unknown">Not sure</option>
              <option value="yes">Indoor</option>
              <option value="no">Outdoor</option>
            </select>
          </label>
        </div>
        <label>
          Where exactly
          <input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={300} placeholder="e.g. By the restrooms behind Pecos Bill" />
        </label>
        <label>
          Last confirmed
          <input type="date" value={confirmed} onChange={(e) => setConfirmed(e.target.value)} />
        </label>
        <InlineMsg kind="error">{error}</InlineMsg>
        <div className="form-actions">
          {refill &&
            (confirmDelete ? (
              <button type="button" className="btn btn--danger" onClick={async () => { await deleteRefill(refill.id); useUi.getState().selectRefill(null); onClose(); }}>
                Really delete
              </button>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            ))}
          <button type="submit" className="btn btn--primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
