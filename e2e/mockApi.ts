import type { BrowserContext, Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { normalizeSeed, type CoordFile, type SeedFile } from '../src/shared/normalize';
import type { DataSnapshot, Favourite } from '../src/shared/types';
import type { SyncOp } from '../src/shared/sync';

export const FAMILY = [
  { email: 'oliver@example.com', name: 'Oliver', role: 'admin' as const },
  { email: 'sam@example.com', name: 'Sam', role: 'member' as const },
];
export const PASSCODE = 'mickey';

/** A tiny in-memory stand-in for the Vercel functions, shared by every page in a context. */
export class MockApi {
  signedIn: string | null = null;
  favourites: Favourite[] = [];
  ops: SyncOp[] = [];
  snapshot: DataSnapshot;
  requests: string[] = [];

  constructor() {
    const seed = normalizeSeed(
      JSON.parse(readFileSync('seed/locations.json', 'utf8')) as SeedFile,
      JSON.parse(readFileSync('seed/coordinates.json', 'utf8')) as CoordFile,
    );
    this.snapshot = {
      generated_at: new Date().toISOString(),
      ...seed,
      favourites: [],
      theme_overrides: [],
      family: FAMILY.map(({ email, name }) => ({ email, name })),
    };
  }

  async install(ctx: BrowserContext) {
    await ctx.route('**/api/**', (route) => this.handle(route));
    // No tiles in CI: keep the map blank rather than erroring.
    await ctx.route(/tile\.openstreetmap\.org|arcgisonline|googleusercontent/, (r) => r.abort());
  }

  private json(route: Route, status: number, body: unknown) {
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  }

  private async handle(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    this.requests.push(`${req.method()} ${url.pathname}`);
    const user = FAMILY.find((f) => f.email === this.signedIn);
    switch (url.pathname) {
      case '/api/login': {
        const { email, passcode } = req.postDataJSON() as { email: string; passcode: string };
        const u = FAMILY.find((f) => f.email === email.trim().toLowerCase());
        if (!u || passcode !== PASSCODE) return this.json(route, 401, { error: "That email and passcode don't match the family list." });
        this.signedIn = u.email;
        return this.json(route, 200, { user: u });
      }
      case '/api/logout':
        this.signedIn = null;
        return this.json(route, 200, { ok: true });
    }
    if (!user) return this.json(route, 401, { error: 'Please sign in.' });
    if (url.pathname.startsWith('/api/media/')) {
      // A tiny test image (stands in for stored photos).
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      return route.fulfill({ status: 200, contentType: 'image/png', body: png });
    }
    switch (url.pathname) {
      case '/api/me':
        return this.json(route, 200, { user });
      case '/api/data':
        return this.json(route, 200, { ...this.snapshot, favourites: this.favourites, generated_at: new Date().toISOString() });
      case '/api/changes':
        return this.json(route, 200, {
          cursor: new Date().toISOString(),
          locations: [],
          menu_items: [],
          refill_stations: [],
          favourites: this.favourites,
          deleted: [],
        });
      case '/api/sync': {
        const { ops } = req.postDataJSON() as { ops: SyncOp[] };
        this.ops.push(...ops);
        for (const op of ops) {
          if (op.kind === 'favourite') {
            this.favourites = this.favourites.filter((f) => !(f.user_email === user.email && f.location_id === op.location_id));
            this.favourites.push({ user_email: user.email, location_id: op.location_id, starred: op.starred, visited_on: op.visited_on, updated_at: op.updated_at });
          }
        }
        return this.json(route, 200, { results: ops.map((o) => ({ op_id: o.op_id, status: 'applied' })) });
      }
      default:
        return this.json(route, 404, { error: 'Not found.' });
    }
  }

  /** Simulates another family member starring a place. */
  familyStar(email: string, locationId: string) {
    this.favourites.push({ user_email: email, location_id: locationId, starred: true, visited_on: null, updated_at: new Date().toISOString() });
  }
}
