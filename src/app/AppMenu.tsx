import { useState } from 'react';
import { EditsLog } from '../admin/EditsLog';
import { LOCAL_ONLY } from '../config';
import { useLastSync } from '../data/hooks';
import { useSession } from '../data/session';
import { syncNow } from '../data/sync';
import { useSync } from '../data/syncState';
import { useUi } from '../store';
import { Modal } from '../ui/Modal';

export function AppMenu() {
  const { menuOpen, set, satellite, editMode } = useUi();
  const { user, signOut } = useSession();
  const syncing = useSync((s) => s.syncing);
  const lastSync = useLastSync();
  const [history, setHistory] = useState(false);
  if (history) return <EditsLog onClose={() => setHistory(false)} />;
  if (!menuOpen) return null;
  const close = () => set({ menuOpen: false });
  return (
    <Modal title="Park Plate" onClose={close}>
      <div className="menu-list">
        <p className="who">
          Signed in as <strong>{user?.name ?? user?.email}</strong>
          {user?.role === 'admin' ? ' (admin)' : ''}
          {LOCAL_ONLY && ' · local-only mode, changes stay on this device'}
        </p>
        <label className="switch">
          <input type="checkbox" checked={satellite} onChange={(e) => set({ satellite: e.target.checked })} />
          Satellite view <span className="hint">(needs signal)</span>
        </label>
        {user?.role === 'admin' && (
          <label className="switch">
            <input type="checkbox" checked={editMode} onChange={(e) => set({ editMode: e.target.checked, moving: null })} />
            Edit mode <span className="hint">(edit menus, move pins, long-press map to add a refill)</span>
          </label>
        )}
        {!LOCAL_ONLY && (
          <button type="button" className="btn" disabled={syncing} onClick={() => void syncNow({ full: true })}>
            {syncing ? 'Refreshing…' : 'Refresh all data'}
          </button>
        )}
        {!LOCAL_ONLY && user?.role === 'admin' && (
          <button type="button" className="btn" onClick={() => { close(); setHistory(true); }}>
            Edit history
          </button>
        )}
        <p className="hint">Last synced {lastSync ? new Date(lastSync).toLocaleString('en-GB') : 'never'}.</p>
        <p className="hint">
          Pin colours: <span className="dot dot--quick_service" /> QS credit · <span className="dot dot--snack" /> Snack credit ·{' '}
          <span className="dot dot--none" /> Not on plan. Map data © OpenStreetMap contributors.
        </p>
        {!LOCAL_ONLY && (
          <button type="button" className="btn btn--ghost" onClick={() => { close(); void signOut(); }}>
            Sign out
          </button>
        )}
      </div>
    </Modal>
  );
}
