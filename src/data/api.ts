import type { ChangesResponse, SyncOp, SyncResult } from '../shared/sync';
import type { DataSnapshot, SessionUser } from '../shared/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Network failure (offline, DNS, etc.), as opposed to an HTTP error. */
export class OfflineError extends Error {}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: { 'x-park-plate': '1', ...(init.body && typeof init.body === 'string' ? { 'content-type': 'application/json' } : {}), ...init.headers },
    });
  } catch {
    throw new OfflineError('No connection.');
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON (e.g. the SPA fallback when /api isn't deployed).
  }
  if (!res.ok) {
    const msg = (body as { error?: string } | null)?.error ?? `Request failed (${res.status}).`;
    throw new ApiError(res.status, msg);
  }
  if (body === null && text) throw new ApiError(502, 'The server sent an unexpected response.');
  return body as T;
}

export const api = {
  me: () => call<{ user: SessionUser }>('/api/me'),
  login: (email: string, passcode: string) =>
    call<{ user: SessionUser }>('/api/login', { method: 'POST', body: JSON.stringify({ email, passcode }) }),
  logout: () => call<{ ok: true }>('/api/logout', { method: 'POST', body: '{}' }),
  data: () => call<DataSnapshot>('/api/data'),
  changes: (since: string) => call<ChangesResponse>(`/api/changes?since=${encodeURIComponent(since)}`),
  sync: (ops: SyncOp[]) => call<{ results: SyncResult[] }>('/api/sync', { method: 'POST', body: JSON.stringify({ ops }) }),
  edits: () => call<{ edits: EditLogRow[] }>('/api/edits'),
  upload: (blob: Blob) =>
    call<{ id: string; path: string }>('/api/media', { method: 'POST', body: blob, headers: { 'content-type': blob.type } }),
  placesPhoto: (locationId: string) =>
    call<{ photoUri: string; attributions: { name: string; uri: string | null }[] }>(
      `/api/places-photo?location_id=${encodeURIComponent(locationId)}`,
    ),
};

export interface EditLogRow {
  id: string;
  user_email: string | null;
  table_name: string;
  row_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  at: string;
}
