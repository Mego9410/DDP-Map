import { useState } from 'react';
import { deleteItem, newItemId, saveItem } from '../data/actions';
import { validateItem } from '../shared/validate';
import type { ItemSection, MenuItem, Tri } from '../shared/types';
import { InlineMsg, Modal } from '../ui/Modal';

const TRI_LABEL: Record<Tri, string> = { yes: 'Yes', no: 'No', unknown: 'Not sure' };

export function blankItem(locationId: string, section: ItemSection, sort: number): Omit<MenuItem, 'updated_at'> {
  return {
    id: newItemId(),
    location_id: locationId,
    section,
    name: '',
    price_usd: null,
    qs_eligible: section === 'entree' || section === 'kids' ? 'yes' : 'no',
    snack_eligible: 'unknown',
    seasonal: false,
    note: null,
    sort,
  };
}

export function EditItem({ item, isNew, onClose }: { item: Omit<MenuItem, 'updated_at'>; isNew: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState(item);
  const [priceText, setPriceText] = useState(item.price_usd == null ? '' : item.price_usd.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const up = (p: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...p }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = priceText.trim().replace(/^\$/, '');
    if (trimmed !== '' && !Number.isFinite(Number(trimmed))) return setError('Price must be a number, e.g. 12.49.');
    const price_usd = trimmed === '' ? null : Math.round(Number(trimmed) * 100) / 100;
    const next = { ...draft, name: draft.name.trim(), note: draft.note?.trim() || null, price_usd };
    const err = validateItem(next);
    if (err) return setError(err);
    await saveItem(next);
    onClose();
  };

  return (
    <Modal title={isNew ? 'Add menu item' : 'Edit menu item'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Name
          <input value={draft.name} onChange={(e) => up({ name: e.target.value })} maxLength={200} required />
        </label>
        <div className="form-row">
          <label>
            Price (USD)
            <input inputMode="decimal" value={priceText} onChange={(e) => setPriceText(e.target.value)} placeholder="Not listed" />
          </label>
          <label>
            Section
            <select value={draft.section} onChange={(e) => up({ section: e.target.value as ItemSection })}>
              <option value="entree">Entrée</option>
              <option value="kids">Kids’ meal</option>
              <option value="snack">Snack / side / dessert</option>
              <option value="drink">Drink</option>
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            Covered by a QS credit?
            <select value={draft.qs_eligible} onChange={(e) => up({ qs_eligible: e.target.value as Tri })}>
              {(['yes', 'no', 'unknown'] as Tri[]).map((t) => (
                <option key={t} value={t}>{TRI_LABEL[t]}</option>
              ))}
            </select>
          </label>
          <label>
            Snack credit (DDP symbol)?
            <select value={draft.snack_eligible} onChange={(e) => up({ snack_eligible: e.target.value as Tri })}>
              {(['yes', 'no', 'unknown'] as Tri[]).map((t) => (
                <option key={t} value={t}>{TRI_LABEL[t]}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Note
          <input value={draft.note ?? ''} onChange={(e) => up({ note: e.target.value })} maxLength={500} placeholder="e.g. plant-based" />
        </label>
        <label className="check">
          <input type="checkbox" checked={draft.seasonal} onChange={(e) => up({ seasonal: e.target.checked })} /> Seasonal / limited time
        </label>
        <InlineMsg kind="error">{error}</InlineMsg>
        <div className="form-actions">
          {!isNew &&
            (confirmDelete ? (
              <button type="button" className="btn btn--danger" onClick={async () => { await deleteItem(draft.id); onClose(); }}>
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
