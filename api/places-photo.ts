// First-build photo proxy (TRD §8.4): looks up a Google Places photo for a
// location and returns a short-lived photo URL plus the required author
// attribution. Nothing from Google is stored on our side.

import { HttpError } from './_lib/db.js';
import { handler, json, requireUser } from './_lib/http.js';

interface PlacePhoto {
  name: string;
  authorAttributions?: { displayName?: string; uri?: string }[];
}

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
  const photo = ((await place.json()) as { photos?: PlacePhoto[] }).photos?.[0];
  if (!photo) throw new HttpError(404, 'Google has no photo for this place.');

  const media = await fetch(
    `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=1600&skipHttpRedirect=true`,
    { headers: { 'X-Goog-Api-Key': key } },
  );
  if (!media.ok) throw new HttpError(502, 'Google photo lookup failed.');
  const { photoUri } = (await media.json()) as { photoUri?: string };
  if (!photoUri) throw new HttpError(404, 'Google has no photo for this place.');

  const attributions = (photo.authorAttributions ?? [])
    .map((a) => ({ name: a.displayName ?? 'Google Maps contributor', uri: a.uri ?? null }));
  return json({ photoUri, attributions }, { headers: { 'Cache-Control': 'private, max-age=3600' } });
});
