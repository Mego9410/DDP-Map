// Every write goes through here: Dexie first (so the UI updates offline),
// then the outbox (so the family sees it once there's signal).

import { LOCAL_ONLY } from '../config';
import { randomUuid } from '../shared/ids';
import type { LocationPatch } from '../shared/sync';
import type { MenuItem, RefillStation } from '../shared/types';
import { api } from './api';
import { db, favouriteKey, itemKey, locationKey, refillKey } from './db';
import { useSession } from './session';
import { enqueue } from './sync';

const now = () => new Date().toISOString();
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function me(): string {
  const u = useSession.getState().user;
  if (!u) throw new Error('Not signed in.');
  return u.email;
}

async function setFavourite(locationId: string, change: { starred?: boolean; visited_on?: string | null }) {
  const email = me();
  const cur = await db.favourites.get([email, locationId]);
  const next = {
    user_email: email,
    location_id: locationId,
    starred: change.starred ?? cur?.starred ?? false,
    visited_on: change.visited_on !== undefined ? change.visited_on : cur?.visited_on ?? null,
    updated_at: now(),
  };
  await enqueue(
    { op_id: randomUuid(), kind: 'favourite', location_id: locationId, starred: next.starred, visited_on: next.visited_on, updated_at: next.updated_at },
    favouriteKey(email, locationId),
    () => db.favourites.put(next),
  );
}

export async function toggleStar(locationId: string): Promise<void> {
  const cur = await db.favourites.get([me(), locationId]);
  await setFavourite(locationId, { starred: !cur?.starred });
}

export async function toggleVisited(locationId: string): Promise<void> {
  const cur = await db.favourites.get([me(), locationId]);
  await setFavourite(locationId, { visited_on: cur?.visited_on ? null : today() });
}

export async function updateLocation(id: string, patch: LocationPatch): Promise<void> {
  const updated_at = now();
  await enqueue({ op_id: randomUuid(), kind: 'location', id, patch, updated_at }, locationKey(id), () =>
    db.locations.update(id, { ...patch, updated_at }),
  );
}

export async function saveItem(item: Omit<MenuItem, 'updated_at'>): Promise<void> {
  const updated_at = now();
  await enqueue({ op_id: randomUuid(), kind: 'item_upsert', item, updated_at }, itemKey(item.id), () =>
    db.menu_items.put({ ...item, updated_at }),
  );
}

export async function deleteItem(id: string): Promise<void> {
  await enqueue({ op_id: randomUuid(), kind: 'item_delete', id, updated_at: now() }, itemKey(id), () => db.menu_items.delete(id));
}

export function newItemId(): string {
  return randomUuid();
}

export async function saveRefill(refill: Omit<RefillStation, 'updated_at'>): Promise<void> {
  const updated_at = now();
  await enqueue({ op_id: randomUuid(), kind: 'refill_upsert', refill, updated_at }, refillKey(refill.id), () =>
    db.refill_stations.put({ ...refill, updated_at }),
  );
}

export async function deleteRefill(id: string): Promise<void> {
  await enqueue({ op_id: randomUuid(), kind: 'refill_delete', id, updated_at: now() }, refillKey(id), () =>
    db.refill_stations.delete(id),
  );
}

/**
 * Resizes to at most `max` px on the long edge and re-encodes as WebP
 * (TRD §8.4). SVG logos are kept as-is.
 */
export async function prepareImage(file: File, max = 1600): Promise<Blob> {
  if (file.type === 'image/svg+xml') return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.82));
  if (!blob) throw new Error('This browser could not convert the image.');
  return blob;
}

/** Uploads an image and points the location's hero or logo at it. Needs signal in API mode. */
export async function replaceImage(locationId: string, field: 'hero_path' | 'logo_path', file: File): Promise<void> {
  const blob = await prepareImage(file, field === 'logo_path' ? 600 : 1600);
  let path: string;
  if (LOCAL_ONLY) {
    const id = randomUuid();
    await db.media.put({ id, blob });
    path = `/api/media/${id}`;
  } else {
    path = (await api.upload(blob)).path;
  }
  await updateLocation(locationId, field === 'hero_path' ? { hero_path: path, hero_attribution: null } : { logo_path: path });
}
