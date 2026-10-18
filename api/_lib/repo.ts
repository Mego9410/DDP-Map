// All SQL lives here. Dates come back as ISO strings and numerics as numbers
// so the JSON the client caches matches src/shared/types.ts exactly.

import type { DataSnapshot, Favourite, Location, MenuItem, RefillStation } from '../../src/shared/types.js';
import type { ChangesResponse, SyncOp, SyncResult } from '../../src/shared/sync.js';
import { ADMIN_OPS } from '../../src/shared/sync.js';
import { validateOp } from '../../src/shared/validate.js';
import type { Db, Stmt } from './db.js';

const iso = (col: string) => `to_char((${col}) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

const LOCATION_COLS = `id, park_id, land_id, area_label, name, short_name, credit::text as credit, credit_note,
  meals, hours, mobile_order, seasonal, lng, lat, coord_source, google_place_id, logo_path, hero_path,
  hero_attribution, photos, theme_id, menu_as_of::text as menu_as_of, sources, notes, ${iso('updated_at')} as updated_at`;

const ITEM_COLS = `id::text as id, location_id, section::text as section, name, price_usd::float8 as price_usd,
  qs_eligible::text as qs_eligible, snack_eligible::text as snack_eligible, seasonal, note, sort,
  ${iso('updated_at')} as updated_at`;

const REFILL_COLS = `id::text as id, park_id, kind::text as kind, lng, lat, indoor, description, osm_id,
  last_confirmed::text as last_confirmed, ${iso('updated_at')} as updated_at`;

const FAV_COLS = `user_email, location_id, starred, visited_on::text as visited_on, ${iso('updated_at')} as updated_at`;

export async function snapshot(db: Db): Promise<DataSnapshot> {
  const [parks, lands, locations, menu_items, refill_stations, favourites, themes, family, now] = await db.tx([
    { text: 'select id, name, short_name, center_lng, center_lat, default_zoom::float8 as default_zoom from parks order by id' },
    { text: 'select id, park_id, name from lands order by id' },
    { text: `select ${LOCATION_COLS} from locations order by park_id, name` },
    { text: `select ${ITEM_COLS} from menu_items order by location_id, sort` },
    { text: `select ${REFILL_COLS} from refill_stations order by park_id` },
    { text: `select ${FAV_COLS} from favourites` },
    { text: 'select id, label, tokens from themes' },
    { text: 'select email, name from family_members order by email' },
    { text: `select ${iso("now() - interval '5 seconds'")} as cursor` },
  ]);
  return {
    generated_at: String(now[0].cursor),
    parks: parks as never,
    lands: lands as never,
    locations: locations as never,
    menu_items: menu_items as never,
    refill_stations: refill_stations as never,
    favourites: favourites as never,
    theme_overrides: themes as never,
    family: family as never,
  };
}

export async function changesSince(db: Db, since: string): Promise<ChangesResponse> {
  const [locations, menu_items, refill_stations, favourites, deleted, now] = await db.tx([
    { text: `select ${LOCATION_COLS} from locations where changed_at > $1`, params: [since] },
    { text: `select ${ITEM_COLS} from menu_items where changed_at > $1`, params: [since] },
    { text: `select ${REFILL_COLS} from refill_stations where changed_at > $1`, params: [since] },
    { text: `select ${FAV_COLS} from favourites where changed_at > $1`, params: [since] },
    { text: 'select table_name, row_id from deletions where changed_at > $1', params: [since] },
    // Overlap the next window a little so rows from transactions that were
    // still committing at this moment are not skipped.
    { text: `select ${iso("now() - interval '5 seconds'")} as cursor` },
  ]);
  return {
    cursor: String(now[0].cursor),
    locations: locations as unknown as Location[],
    menu_items: menu_items as unknown as MenuItem[],
    refill_stations: refill_stations as unknown as RefillStation[],
    favourites: favourites as unknown as Favourite[],
    deleted: deleted as ChangesResponse['deleted'],
  };
}

/** Clamp editor clocks that run far ahead so they can't lock a row forever. */
export function clampTimestamp(ts: string, now = Date.now()): string {
  const t = Date.parse(ts);
  return new Date(Math.min(t, now + 60_000)).toISOString();
}

function actor(email: string): Stmt {
  return { text: "select set_config('app.user_email', $1, true)", params: [email] };
}

/** Applied when the row is gone afterwards; stale when a newer edit kept it. */
function deleteStmt(table: 'menu_items' | 'refill_stations', id: string, ts: string): Stmt {
  return {
    text: `with d as (delete from ${table} where id = $1 and updated_at <= $2 returning 1)
           select 1 as ok where exists (select 1 from d) or not exists (select 1 from ${table} where id = $1)`,
    params: [id, ts],
  };
}

function statementFor(op: SyncOp, email: string, ts: string): Stmt {
  switch (op.kind) {
    case 'favourite':
      return {
        text: `insert into favourites (user_email, location_id, starred, visited_on, updated_at)
               values ($1, $2, $3, $4, $5)
               on conflict (user_email, location_id) do update
                 set starred = excluded.starred, visited_on = excluded.visited_on, updated_at = excluded.updated_at
                 where favourites.updated_at <= excluded.updated_at
               returning 1 as ok`,
        params: [email, op.location_id, op.starred, op.visited_on, ts],
      };
    case 'location': {
      const keys = Object.keys(op.patch) as (keyof typeof op.patch)[];
      const sets = keys.map((k, i) => `${k} = $${i + 3}${k === 'credit' ? '::credit_type' : k === 'menu_as_of' ? '::date' : k === 'photos' ? '::jsonb' : ''}`);
      return {
        text: `update locations set ${sets.join(', ')}, updated_at = $2
               where id = $1 and updated_at <= $2 returning 1 as ok`,
        params: [op.id, ts, ...keys.map((k) => (k === 'photos' ? JSON.stringify(op.patch[k]) : op.patch[k]))],
      };
    }
    case 'item_upsert': {
      const i = op.item;
      return {
        text: `insert into menu_items (id, location_id, section, name, price_usd, qs_eligible, snack_eligible, seasonal, note, sort, updated_at)
               values ($1, $2, $3::item_section, $4, $5, $6::tri, $7::tri, $8, $9, $10, $11)
               on conflict (id) do update set
                 section = excluded.section, name = excluded.name, price_usd = excluded.price_usd,
                 qs_eligible = excluded.qs_eligible, snack_eligible = excluded.snack_eligible,
                 seasonal = excluded.seasonal, note = excluded.note, sort = excluded.sort,
                 updated_at = excluded.updated_at
               where menu_items.updated_at <= excluded.updated_at and menu_items.location_id = excluded.location_id
               returning 1 as ok`,
        params: [i.id, i.location_id, i.section, i.name.trim(), i.price_usd, i.qs_eligible, i.snack_eligible, i.seasonal, i.note, i.sort, ts],
      };
    }
    case 'item_delete':
      return deleteStmt('menu_items', op.id, ts);
    case 'refill_upsert': {
      const r = op.refill;
      return {
        text: `insert into refill_stations (id, park_id, kind, lng, lat, indoor, description, osm_id, last_confirmed, updated_at)
               values ($1, $2, $3::refill_kind, $4, $5, $6, $7, $8, $9::date, $10)
               on conflict (id) do update set
                 park_id = excluded.park_id, kind = excluded.kind, lng = excluded.lng, lat = excluded.lat,
                 indoor = excluded.indoor, description = excluded.description,
                 last_confirmed = excluded.last_confirmed, updated_at = excluded.updated_at
               where refill_stations.updated_at <= excluded.updated_at
               returning 1 as ok`,
        params: [r.id, r.park_id, r.kind, r.lng, r.lat, r.indoor, r.description, r.osm_id, r.last_confirmed, ts],
      };
    }
    case 'refill_delete':
      return deleteStmt('refill_stations', op.id, ts);
  }
}

export async function applyOps(db: Db, ops: unknown[], user: { email: string; role: string }): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const raw of ops) {
    const opId = (raw as { op_id?: unknown })?.op_id;
    const op_id = typeof opId === 'string' ? opId : '?';
    const err = validateOp(raw);
    if (err) {
      results.push({ op_id, status: 'rejected', error: err });
      continue;
    }
    const op = raw as SyncOp;
    if (ADMIN_OPS.has(op.kind) && user.role !== 'admin') {
      results.push({ op_id, status: 'rejected', error: 'Only the admin can edit data.' });
      continue;
    }
    try {
      const [, rows] = await db.tx([actor(user.email), statementFor(op, user.email, clampTimestamp(op.updated_at))]);
      results.push({ op_id, status: rows.length ? 'applied' : 'stale' });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({ op_id, status: 'rejected', error: /foreign key/i.test(message) ? 'That restaurant no longer exists.' : 'The server could not save this change.' });
      console.error('sync op failed', op.kind, message);
    }
  }
  return results;
}

export async function recentEdits(db: Db, limit = 100) {
  return db.query(
    `select id::text as id, user_email, table_name, row_id, before, after, ${iso('at')} as at
     from edits_log order by at desc limit $1`,
    [limit],
  );
}
