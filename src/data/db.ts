import Dexie, { type Table } from 'dexie';
import type { Favourite, Land, Location, MenuItem, Park, RefillStation, SessionUser, Theme } from '../shared/types';
import type { SyncOp } from '../shared/sync';

export interface OutboxRow {
  seq?: number;
  op: SyncOp;
  /** Row key this op touches, so incoming changes don't clobber pending edits. */
  key: string;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

/** Images added in local-only mode (in API mode they live in Postgres). */
export interface LocalMedia {
  id: string;
  blob: Blob;
}

export class ParkPlateDb extends Dexie {
  parks!: Table<Park, string>;
  lands!: Table<Land, string>;
  locations!: Table<Location, string>;
  menu_items!: Table<MenuItem, string>;
  refill_stations!: Table<RefillStation, string>;
  favourites!: Table<Favourite, [string, string]>;
  themes!: Table<Theme, string>;
  outbox!: Table<OutboxRow, number>;
  meta!: Table<MetaRow, string>;
  media!: Table<LocalMedia, string>;

  constructor() {
    super('park-plate');
    this.version(1).stores({
      parks: 'id',
      lands: 'id, park_id',
      locations: 'id, park_id',
      menu_items: 'id, location_id',
      refill_stations: 'id, park_id',
      favourites: '[user_email+location_id], location_id, user_email',
      themes: 'id',
      outbox: '++seq, key',
      meta: 'key',
      media: 'id',
    });
  }
}

export const db = new ParkPlateDb();

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

export const META = {
  cursor: 'cursor',
  lastSync: 'lastSync',
  user: 'user',
  seeded: 'seeded',
  syncError: 'syncError',
  tilesCachedAt: 'tilesCachedAt',
  family: 'family',
} as const;

export type CachedUser = SessionUser;

export function itemKey(id: string) {
  return `menu_items:${id}`;
}
export function locationKey(id: string) {
  return `locations:${id}`;
}
export function refillKey(id: string) {
  return `refill_stations:${id}`;
}
export function favouriteKey(email: string, locationId: string) {
  return `favourites:${email}|${locationId}`;
}

export async function clearAll(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}
