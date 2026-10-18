import { useState } from 'react';
import { LOCAL_ONLY } from '../config';
import { replaceImage, updateLocation } from '../data/actions';
import { useSync } from '../data/syncState';
import { THEMES } from '../shared/themes';
import type { LocationPatch } from '../shared/sync';
import type { Credit, Location, Meal } from '../shared/types';
import { validateLocationPatch } from '../shared/validate';
import { InlineMsg, Modal } from '../ui/Modal';

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner'];

export function EditLocation({ location, onClose }: { location: Location; onClose: () => void }) {
  const [d, setD] = useState({
    name: location.name,
    short_name: location.short_name ?? '',
    credit: location.credit,
    credit_note: location.credit_note ?? '',
    hours: location.hours ?? '',
    mobile_order: location.mobile_order,
    seasonal: location.seasonal,
    meals: location.meals,
    menu_as_of: location.menu_as_of ?? '',
    theme_id: location.theme_id ?? '',
    notes: location.notes ?? '',
    hero_attribution: location.hero_attribution ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const up = (p: Partial<typeof d>) => setD((x) => ({ ...x, ...p }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const full: LocationPatch = {
      name: d.name.trim(),
      short_name: d.short_name.trim() || null,
      credit: d.credit,
      credit_note: d.credit_note.trim() || null,
      hours: d.hours.trim() || null,
      mobile_order: d.mobile_order,
      seasonal: d.seasonal,
      meals: d.meals,
      menu_as_of: d.menu_as_of || null,
      theme_id: d.theme_id || null,
      notes: d.notes.trim() || null,
      hero_attribution: d.hero_attribution.trim() || null,
    };
    // Send only what changed so concurrent edits to other fields aren't overwritten.
    const patch = Object.fromEntries(
      Object.entries(full).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify((location as unknown as Record<string, unknown>)[k])),
    ) as LocationPatch;
    if (!Object.keys(patch).length) return onClose();
    const err = validateLocationPatch(patch);
    if (err) return setError(err);
    await updateLocation(location.id, patch);
    onClose();
  };

  return (
    <Modal title={`Edit ${location.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Name
          <input value={d.name} onChange={(e) => up({ name: e.target.value })} required maxLength={120} />
        </label>
        <div className="form-row">
          <label>
            Pin label
            <input value={d.short_name} onChange={(e) => up({ short_name: e.target.value })} maxLength={40} />
          </label>
          <label>
            Credit type
            <select value={d.credit} onChange={(e) => up({ credit: e.target.value as Credit })}>
              <option value="quick_service">Quick-Service credit</option>
              <option value="snack">Snack credit only</option>
              <option value="none">Not on plan</option>
            </select>
          </label>
        </div>
        <label>
          Credit note
          <input value={d.credit_note} onChange={(e) => up({ credit_note: e.target.value })} placeholder="e.g. Sources disagree; confirm at counter" />
        </label>
        <label>
          Hours
          <input value={d.hours} onChange={(e) => up({ hours: e.target.value })} placeholder="e.g. 10:30am – park close" />
        </label>
        <fieldset className="form-row">
          <legend>Meals</legend>
          {MEALS.map((m) => (
            <label key={m} className="check">
              <input
                type="checkbox"
                checked={d.meals.includes(m)}
                onChange={(e) => up({ meals: e.target.checked ? MEALS.filter((x) => x === m || d.meals.includes(x)) : d.meals.filter((x) => x !== m) })}
              />{' '}
              {m}
            </label>
          ))}
        </fieldset>
        <div className="form-row">
          <label>
            Mobile order
            <select
              value={d.mobile_order == null ? 'unknown' : d.mobile_order ? 'yes' : 'no'}
              onChange={(e) => up({ mobile_order: e.target.value === 'unknown' ? null : e.target.value === 'yes' })}
            >
              <option value="unknown">Not sure</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label>
            Menu as of
            <input type="date" value={d.menu_as_of} onChange={(e) => up({ menu_as_of: e.target.value })} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={d.seasonal} onChange={(e) => up({ seasonal: e.target.checked })} /> Seasonal location
        </label>
        <label>
          Menu theme
          <select value={d.theme_id} onChange={(e) => up({ theme_id: e.target.value })}>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Notes
          <textarea rows={5} value={d.notes} onChange={(e) => up({ notes: e.target.value })} maxLength={4000} />
        </label>
        {location.hero_path && (
          <label>
            Photo credit line
            <input value={d.hero_attribution} onChange={(e) => up({ hero_attribution: e.target.value })} placeholder="e.g. Photo: Oliver, Oct 2026" />
          </label>
        )}
        <InlineMsg kind="error">{error}</InlineMsg>
        <div className="form-actions">
          <button type="submit" className="btn btn--primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ImageButtons({ location }: { location: Location }) {
  const online = useSync((s) => s.online);
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok' | 'info'; text: string } | null>(null);
  const pick = (field: 'hero_path' | 'logo_path') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMsg({ kind: 'info', text: 'Uploading…' });
    replaceImage(location.id, field, file)
      .then(() => setMsg({ kind: 'ok', text: field === 'hero_path' ? 'Photo replaced.' : 'Logo updated.' }))
      .catch((err: unknown) => setMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Upload failed.' }));
  };
  const disabled = !LOCAL_ONLY && !online;
  return (
    <div className="admin-row">
      <label className={`btn btn--small${disabled ? ' is-disabled' : ''}`}>
        Replace photo
        <input type="file" accept="image/*" capture="environment" hidden disabled={disabled} onChange={pick('hero_path')} />
      </label>
      <label className={`btn btn--small${disabled ? ' is-disabled' : ''}`}>
        Upload logo
        <input type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" hidden disabled={disabled} onChange={pick('logo_path')} />
      </label>
      {disabled && <InlineMsg>Photos upload once you have signal.</InlineMsg>}
      {msg && <InlineMsg kind={msg.kind}>{msg.text}</InlineMsg>}
    </div>
  );
}
