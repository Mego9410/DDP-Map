import { useEffect } from 'react';
import { RefillForm } from '../admin/AddRefill';
import { MovePinBar } from '../admin/MovePin';
import { Login } from '../auth/Login';
import { useSession } from '../data/session';
import { loadLocalSeed, startSyncLoop } from '../data/sync';
import { useSync } from '../data/syncState';
import { FilterBar } from '../filters/FilterBar';
import { ListHeader, ListView } from '../list/ListView';
import { MapView } from '../map/MapView';
import { useGeolocation } from '../near/useGeolocation';
import { DetailHeader, DetailSheet } from '../sheet/DetailSheet';
import { RefillDetail } from '../sheet/RefillDetail';
import { Sheet } from '../sheet/Sheet';
import { useUi } from '../store';
import { Banner } from '../ui/Banner';
import { AppMenu } from './AppMenu';

function Main() {
  const { selectedId, selectedRefillId, snap, set, addingRefill } = useUi();
  const locate = useGeolocation();
  const authError = useSync((s) => s.authError);
  const expire = useSession((s) => s.expire);

  useEffect(() => startSyncLoop(), []);
  useEffect(() => {
    if (authError) void expire(authError.status === 403 ? authError.message : 'Your session ended. Sign in again.', authError.status === 403);
  }, [authError, expire]);

  return (
    <div className="app">
      <MapView />
      <FilterBar />
      <Banner />
      <MovePinBar />
      <Sheet
        snap={snap}
        onSnap={(s) => set({ snap: s })}
        label={selectedId ? 'Restaurant details' : selectedRefillId ? 'Refill point' : 'Places list'}
        header={selectedId ? <DetailHeader id={selectedId} /> : selectedRefillId ? null : <ListHeader onLocate={locate} />}
      >
        {selectedId ? <DetailSheet id={selectedId} /> : selectedRefillId ? <RefillDetail id={selectedRefillId} /> : <ListView onLocate={locate} />}
      </Sheet>
      <AppMenu />
      {addingRefill && <RefillForm at={addingRefill} onClose={() => set({ addingRefill: null })} />}
    </div>
  );
}

export function App() {
  const { status, boot } = useSession();
  useEffect(() => {
    void (async () => {
      await loadLocalSeed();
      await boot();
    })();
  }, [boot]);

  if (status === 'loading') return <div className="splash" aria-busy="true">Park Plate</div>;
  if (status === 'signed-out') return <Login />;
  return <Main />;
}
