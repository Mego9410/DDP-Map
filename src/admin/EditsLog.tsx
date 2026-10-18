import { useEffect, useState } from 'react';
import { api, type EditLogRow } from '../data/api';
import { useFamilyNames } from '../data/hooks';
import { InlineMsg, Modal } from '../ui/Modal';

function summary(e: EditLogRow): string {
  const b = e.before ?? {};
  const a = e.after ?? {};
  const name = String(a.name ?? b.name ?? e.row_id);
  if (!e.after) return `Deleted ${name}`;
  if (!e.before) return `Added ${name}`;
  const changed = Object.keys(a).filter((k) => !['updated_at', 'changed_at'].includes(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  return `${name}: ${changed.map((k) => `${k.replace(/_/g, ' ')} ${fmt(b[k])} → ${fmt(a[k])}`).join('; ') || 'no visible change'}`;
}

function fmt(v: unknown): string {
  if (v == null || v === '') return '—';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 40 ? `${s.slice(0, 37)}…` : s;
}

export function EditsLog({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<EditLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const names = useFamilyNames();
  useEffect(() => {
    api.edits().then((r) => setRows(r.edits)).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load the history.'));
  }, []);
  return (
    <Modal title="Edit history" onClose={onClose}>
      <InlineMsg kind="error">{error}</InlineMsg>
      {!rows && !error && <InlineMsg>Loading…</InlineMsg>}
      {rows && !rows.length && <InlineMsg>No edits yet.</InlineMsg>}
      <ol className="edits">
        {rows?.map((e) => (
          <li key={e.id}>
            <span className="edits-what">{summary(e)}</span>
            <span className="edits-who">
              {(e.user_email && names.get(e.user_email)) ?? e.user_email ?? 'script'} ·{' '}
              {new Date(e.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
