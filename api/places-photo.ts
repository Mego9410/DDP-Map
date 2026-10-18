// Live Google Places photos for a location (TRD §8.4): up to five short-lived
// photo URLs, each with the author attribution Google requires. Nothing from
// Google is stored on our side; responses may sit in the browser's HTTP cache
// for an hour.

import { HttpError } from './_lib/db.js';
import { handler, json, requireUser } from './_lib/http.js';

interface PlacePhoto {
  name: string;
  widthPx?: number;
  heightPx?: number;
  authorAttributions?: { displayName?: string; uri?: string }[];
}

export interface PlacesPhotoResponse {
  photos: { photoUri: string; attributions: { name: string; uri: string | null }[] }[];
}

const MAX = 5;

export const GET = handler(async (req) => {
  const { db } = await requireUser(req);
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new HttpError(503, 'Google Places is not configured.');
  const locationId = new URL(req.url).searchParams.get('location_id') ?? '';
  const rows = await db.query<{ google_place_id: string | null }>('select google_place_id from locations where id = $1', [locationId]);
  const placeId = rows[0]?.google_place_id;
  if (!placeId) throw new HttpError(404, 'No Google place is linked to this restaurant yet.');

  const place = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'photos' },
  });
  if (!place.ok) throw new HttpError(502, 'Google Places lookup failed.');
  const refs = (((await place.json()) as { photos?: PlacePhoto[] }).photos ?? [])
    // Landscape first: they fill the hero without awkward crops.
    .sort((a, b) => Number((b.widthPx ?? 0) >= (b.heightPx ?? 0)) - Number((a.widthPx ?? 0) >= (a.heightPx ?? 0)))
    .slice(0, MAX);
  if (!refs.length) throw new HttpError(404, 'Google has no photos for this place.');

  const photos = (
    await Promise.all(
      refs.map(async (ref) => {
        const media = await fetch(`https://places.googleapis.com/v1/${ref.name}/media?maxWidthPx=1600&skipHttpRedirect=true`, {
          headers: { 'X-Goog-Api-Key': key },
        });
        if (!media.ok) return null;
        const { photoUri } = (await media.json()) as { photoUri?: string };
        if (!photoUri) return null;
        return {
          photoUri,
          attributions: (ref.authorAttributions ?? []).map((a) => ({ name: a.displayName ?? 'Google Maps contributor', uri: a.uri ?? null })),
        };
      }),
    )
  ).filter((p): p is NonNullable<typeof p> => p !== null);
  if (!photos.length) throw new HttpError(502, 'Google photo lookup failed.');

  const body: PlacesPhotoResponse = { photos };
  return json(body, { headers: { 'Cache-Control': 'private, max-age=3600' } });
});
