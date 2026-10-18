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

async function storeImage(blob: Blob): Promise<string> {
  if (LOCAL_ONLY) {
    const id = randomUuid();
    await db.media.put({ id, blob });
    return `/api/media/${id}`;
  }
  return (await api.upload(blob)).path;
}

/**
 * Uploads an image and makes it the cover photo or logo. A replaced cover
 * moves into the gallery rather than disappearing. Needs signal in API mode.
 */
export async function replaceImage(locationId: string, field: 'hero_path' | 'logo_path', file: File): Promise<void> {
  const path = await storeImage(await prepareImage(file, field === 'logo_path' ? 600 : 1600));
  if (field === 'logo_path') return updateLocation(locationId, { logo_path: path });
  const loc = await db.locations.get(locationId);
  const photos = [...(loc?.photos ?? [])];
  if (loc?.hero_path && !photos.some((p) => p.path === loc.hero_path)) {
    photos.unshift({ path: loc.hero_path, attribution: loc.hero_attribution, license: null, source_url: null });
  }
  await updateLocation(locationId, { hero_path: path, hero_attribution: null, photos: photos.slice(0, 12) });
}

/** Adds a photo to the place's gallery (after the cover). */
export async function addPhoto(locationId: string, file: File): Promise<void> {
  const path = await storeImage(await prepareImage(file, 1600));
  const loc = await db.locations.get(locationId);
  const photos = [...(loc?.photos ?? []), { path, attribution: null, license: null, source_url: null }].slice(-12);
  await updateLocation(locationId, loc?.hero_path ? { photos } : { hero_path: path, photos });
}

/** Removes a photo from the gallery, or clears the cover if it is the cover. */
export async function removePhoto(locationId: string, path: string): Promise<void> {
  const loc = await db.locations.get(locationId);
  if (!loc) return;
  const photos = (loc.photos ?? []).filter((p) => p.path !== path);
  if (loc.hero_path === path) {
    const next = photos[0] ?? null;
    await updateLocation(locationId, { hero_path: next?.path ?? null, hero_attribution: next?.attribution ?? null, photos });
  } else {
    await updateLocation(locationId, { photos });
  }
}
