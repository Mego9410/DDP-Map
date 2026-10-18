// Keeps Dexie in step with the API (TRD §9). The UI only ever reads Dexie.
//
//  pull: first run fetches the full snapshot, then /api/changes?since=cursor
//  push: the outbox is flushed in order; ops stay queued while offline
//  LWW:  the server keeps whichever write has the newer updated_at; a stale or
//        rejected op triggers a full refresh so the phone matches the server.

import { LOCAL_ONLY, POLL_HIDDEN_MS, POLL_VISIBLE_MS } from '../config';
import type { SyncOp } from '../shared/sync';
import type { DataSnapshot } from '../shared/types';
import { api, ApiError, OfflineError } from './api';
import { db, favouriteKey, getMeta, itemKey, locationKey, META, refillKey, setMeta } from './db';
import { useSync } from './syncState';

async function pendingKeys(): Promise<Set<string>> {
  return new Set((await db.outbox.toArray()).map((r) => r.key));
}

export async function applySnapshot(s: DataSnapshot): Promise<void> {
  const pending = await pendingKeys();
  await db.transaction('rw', [db.parks, db.lands, db.locations, db.menu_items, db.refill_stations, db.favourites, db.themes, db.meta], async () => {
    await db.parks.clear();
    await db.parks.bulkPut(s.parks);
    await db.lands.clear();
    await db.lands.bulkPut(s.lands);

    const keep = async <T,>(table: { toArray(): Promise<T[]>; clear(): Promise<void>; bulkPut(r: T[]): Promise<unknown> }, rows: T[], key: (r: T) => string) => {
      const local = (await table.toArray()).filter((r) => pending.has(key(r)));
      const localKeys = new Set(local.map(key));
      await table.clear();
      await table.bulkPut([...rows.filter((r) => !localKeys.has(key(r))), ...local]);
    };
    await keep(db.locations, s.locations, (r) => locationKey(r.id));
    await keep(db.menu_items, s.menu_items, (r) => itemKey(r.id));
    await keep(db.refill_stations, s.refill_stations, (r) => refillKey(r.id));
    await keep(db.favourites, s.favourites, (r) => favouriteKey(r.user_email, r.location_id));

    await db.themes.clear();
    await db.themes.bulkPut(s.theme_overrides);
    await setMeta(META.family, s.family);
    await setMeta(META.cursor, s.generated_at);
    await setMeta(META.lastSync, new Date().toISOString());
  });
}

async function pullChanges(cursor: string): Promise<void> {
  const c = await api.changes(cursor);
  const pending = await pendingKeys();
  await db.transaction('rw', [db.locations, db.menu_items, db.refill_stations, db.favourites, db.meta], async () => {
    await db.locations.bulkPut(c.locations.filter((r) => !pending.has(locationKey(r.id))));
    await db.menu_items.bulkPut(c.menu_items.filter((r) => !pending.has(itemKey(r.id))));
    await db.refill_stations.bulkPut(c.refill_stations.filter((r) => !pending.has(refillKey(r.id))));
    await db.favourites.bulkPut(c.favourites.filter((r) => !pending.has(favouriteKey(r.user_email, r.location_id))));
    for (const d of c.deleted) {
      if (d.table_name === 'menu_items' && !pending.has(itemKey(d.row_id))) await db.menu_items.delete(d.row_id);
      if (d.table_name === 'refill_stations' && !pending.has(refillKey(d.row_id))) await db.refill_stations.delete(d.row_id);
    }
    await setMeta(META.cursor, c.cursor);
    await setMeta(META.lastSync, new Date().toISOString());
  });
}

/** Sends queued ops. Returns true if the server disagreed with any of them. */
async function flushOutbox(): Promise<boolean> {
  let needsRefresh = false;
  for (;;) {
    const batch = await db.outbox.orderBy('seq').limit(100).toArray();
    if (!batch.length) return needsRefresh;
    const { results } = await api.sync(batch.map((b) => b.op));
    const byOp = new Map(results.map((r) => [r.op_id, r]));
    const errors: string[] = [];
    for (const row of batch) {
      const r = byOp.get(row.op.op_id);
      if (r?.status === 'stale') needsRefresh = true;
      if (r?.status === 'rejected') {
        needsRefresh = true;
        errors.push(r.error ?? 'A change was rejected.');
      }
    }
    await db.outbox.bulkDelete(batch.map((b) => b.seq!));
    if (errors.length) await setMeta(META.syncError, `Not saved: ${[...new Set(errors)].join(' ')}`);
  }
}

let running: Promise<void> | null = null;

/** Push then pull. Safe to call often; concurrent calls share one run. */
export function syncNow(opts: { full?: boolean } = {}): Promise<void> {
  if (LOCAL_ONLY) return Promise.resolve();
  if (running) return running;
  running = (async () => {
    const state = useSync.getState();
    state.set({ syncing: true });
    try {
      const refresh = await flushOutbox();
      const cursor = await getMeta<string>(META.cursor);
      if (opts.full || refresh || !cursor) await applySnapshot(await api.data());
      else await pullChanges(cursor);
      state.set({ online: true, authError: null, lastError: null });
    } catch (e) {
      if (e instanceof OfflineError) state.set({ online: false });
      else if (e instanceof ApiError && (e.status === 401 || e.status === 403)) state.set({ authError: e });
      else state.set({ lastError: e instanceof Error ? e.message : String(e) });
    } finally {
      state.set({ syncing: false });
      running = null;
    }
  })();
  return running;
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Applies a change locally right away and queues it for the server. */
export async function enqueue(op: SyncOp, key: string, applyLocal: () => Promise<unknown>): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await applyLocal();
    if (!LOCAL_ONLY) await db.outbox.add({ op, key });
  });
  if (LOCAL_ONLY) return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void syncNow(), 300);
}

export function startSyncLoop(): () => void {
  if (LOCAL_ONLY) return () => {};
  let timer: ReturnType<typeof setTimeout>;
  const tick = async () => {
    if (navigator.onLine) await syncNow();
    timer = setTimeout(tick, document.visibilityState === 'visible' ? POLL_VISIBLE_MS : POLL_HIDDEN_MS);
  };
  const wake = () => {
    clearTimeout(timer);
    void tick();
  };
  const onOnline = () => {
    useSync.getState().set({ online: true });
    wake();
  };
  const onOffline = () => useSync.getState().set({ online: false });
  const onVisible = () => document.visibilityState === 'visible' && wake();
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);
  void tick();
  return () => {
    clearTimeout(timer);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

/** Local-only mode: load the bundled seed into Dexie once. */
export async function loadLocalSeed(): Promise<void> {
  if (!LOCAL_ONLY) return;
  const [{ default: seed }, { default: coords }, { default: refills }, { normalizeSeed }] = await Promise.all([
    import('../../seed/locations.json'),
    import('../../seed/coordinates.json'),
    import('../../seed/refills.json'),
    import('../shared/normalize'),
  ]);
  const version = (seed as { generated: string }).generated;
  if ((await getMeta<string>(META.seeded)) === version) return;
  const n = normalizeSeed(seed as never, coords as never, refills as never);
  await db.transaction('rw', db.tables, async () => {
    await db.parks.bulkPut(n.parks);
    await db.lands.bulkPut(n.lands);
    // Keep anything already edited on this device.
    const have = new Set(await db.locations.toCollection().primaryKeys());
    await db.locations.bulkPut(n.locations.filter((l) => !have.has(l.id)));
    const haveItems = new Set(await db.menu_items.toCollection().primaryKeys());
    await db.menu_items.bulkPut(n.menu_items.filter((i) => !haveItems.has(i.id)));
    await db.refill_stations.bulkPut(n.refill_stations);
    await setMeta(META.seeded, version);
    await setMeta(META.lastSync, `${version}T00:00:00.000Z`);
  });
}
