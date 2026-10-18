import { useLastSync, useOutboxCount, useSyncError } from '../data/hooks';
import { setMeta, META } from '../data/db';
import { useSync } from '../data/syncState';
import { LOCAL_ONLY } from '../config';

function when(iso: string | undefined): string {
  if (!iso) return 'your last visit';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function Banner() {
  const online = useSync((s) => s.online);
  const lastError = useSync((s) => s.lastError);
  const lastSync = useLastSync();
  const pending = useOutboxCount();
  const syncError = useSyncError();

  if (!online) {
    return (
      <div className="banner banner--offline" role="status">
        Offline – showing menus saved on {when(lastSync)}
        {pending > 0 && ` · ${pending} change${pending === 1 ? '' : 's'} will sync later`}
      </div>
    );
  }
  if (syncError) {
    return (
      <div className="banner banner--error" role="alert">
        {syncError}{' '}
        <button type="button" className="link-btn" onClick={() => void setMeta(META.syncError, null)}>
          Dismiss
        </button>
      </div>
    );
  }
  if (lastError && !LOCAL_ONLY) {
    return (
      <div className="banner banner--error" role="status">
        Can’t reach the server right now. Showing saved menus.
      </div>
    );
  }
  return null;
}
