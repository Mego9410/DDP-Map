-- Park Plate schema for Neon Postgres.
-- Auth is handled by the Vercel functions (allowlisted email + family passcode,
-- signed session cookie), so there is no row-level security here: the database
-- is reachable only with DATABASE_URL, which only the server holds.

create extension if not exists pgcrypto;

create table if not exists family_members (
  email text primary key check (email = lower(email)),
  name text,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

create table if not exists parks (
  id text primary key,
  name text not null,
  short_name text not null,
  center_lng double precision not null,
  center_lat double precision not null,
  default_zoom real not null default 16
);

create table if not exists lands (
  id text primary key,
  park_id text not null references parks(id),
  name text not null
);

do $$ begin
  create type credit_type as enum ('quick_service', 'snack', 'none');
exception when duplicate_object then null; end $$;
do $$ begin
  create type item_section as enum ('entree', 'kids', 'snack', 'drink');
exception when duplicate_object then null; end $$;
do $$ begin
  create type tri as enum ('yes', 'no', 'unknown');
exception when duplicate_object then null; end $$;
do $$ begin
  create type refill_kind as enum ('bottle_filler', 'fountain', 'qs_counter_cup');
exception when duplicate_object then null; end $$;

create table if not exists themes (
  id text primary key,
  label text not null,
  tokens jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists locations (
  id text primary key,
  park_id text not null references parks(id),
  land_id text references lands(id),
  area_label text not null,
  name text not null,
  short_name text,
  credit credit_type not null,
  credit_note text,
  meals text[] not null default '{}',
  hours text,
  mobile_order boolean,
  seasonal boolean not null default false,
  lng double precision,
  lat double precision,
  coord_source text check (coord_source in ('approx', 'places', 'manual')),
  google_place_id text,
  logo_path text,
  hero_path text,
  hero_attribution text,
  theme_id text,
  menu_as_of date,
  sources text[] not null default '{}',
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  location_id text not null references locations(id) on delete cascade,
  section item_section not null,
  name text not null,
  price_usd numeric(6,2),
  qs_eligible tri not null default 'unknown',
  snack_eligible tri not null default 'unknown',
  seasonal boolean not null default false,
  note text,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists menu_items_location_idx on menu_items(location_id);

create table if not exists refill_stations (
  id uuid primary key default gen_random_uuid(),
  park_id text not null references parks(id),
  kind refill_kind not null,
  lng double precision not null,
  lat double precision not null,
  indoor boolean,
  description text,
  osm_id text unique,
  last_confirmed date,
  updated_at timestamptz not null default now()
);

create table if not exists favourites (
  user_email text not null references family_members(email) on delete cascade,
  location_id text not null references locations(id) on delete cascade,
  starred boolean not null default false,
  visited_on date,
  updated_at timestamptz not null default now(),
  primary key (user_email, location_id)
);

-- Photos and logos live here (not in a public bucket) so they are only
-- served to signed-in family members via /api/media/:id.
create table if not exists media (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('image/webp', 'image/png', 'image/jpeg', 'image/svg+xml')),
  bytes bytea not null,
  uploaded_by text references family_members(email),
  created_at timestamptz not null default now()
);

create table if not exists edits_log (
  id bigserial primary key,
  user_email text,
  table_name text not null,
  row_id text not null,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);
create index if not exists edits_log_at_idx on edits_log(at desc);

-- Every update/insert/delete on the editable tables is logged with the
-- editor's email, which the API sets per transaction via
-- set_config('app.user_email', ..., true).
create or replace function log_edit() returns trigger language plpgsql as $$
declare
  rid text;
begin
  if tg_op = 'DELETE' then
    rid := old.id::text;
  else
    rid := new.id::text;
  end if;
  insert into edits_log (user_email, table_name, row_id, before, after)
  values (
    nullif(current_setting('app.user_email', true), ''),
    tg_table_name,
    rid,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['locations', 'menu_items', 'refill_stations', 'themes'] loop
    execute format('drop trigger if exists %I_log on %I', t, t);
    execute format(
      'create trigger %I_log after insert or update or delete on %I for each row
         when (nullif(current_setting(''app.user_email'', true), '''') is not null)
         execute function log_edit()', t, t);
  end loop;
end $$;

-- Sync bookkeeping. `updated_at` is the editor's clock (used for last-write-wins);
-- `changed_at` is the server's clock, so GET /api/changes never misses a row
-- written by a phone whose clock runs slow.
alter table locations add column if not exists changed_at timestamptz not null default now();
alter table menu_items add column if not exists changed_at timestamptz not null default now();
alter table refill_stations add column if not exists changed_at timestamptz not null default now();
alter table favourites add column if not exists changed_at timestamptz not null default now();
create index if not exists locations_changed_idx on locations(changed_at);
create index if not exists menu_items_changed_idx on menu_items(changed_at);
create index if not exists refill_stations_changed_idx on refill_stations(changed_at);
create index if not exists favourites_changed_idx on favourites(changed_at);

create table if not exists deletions (
  table_name text not null,
  row_id text not null,
  changed_at timestamptz not null default now(),
  primary key (table_name, row_id)
);

create or replace function touch_changed_at() returns trigger language plpgsql as $$
begin
  new.changed_at := now();
  return new;
end $$;

create or replace function record_deletion() returns trigger language plpgsql as $$
begin
  insert into deletions (table_name, row_id) values (tg_table_name, old.id::text)
  on conflict (table_name, row_id) do update set changed_at = now();
  return old;
end $$;

do $$
declare t text;
begin
  foreach t in array array['locations', 'menu_items', 'refill_stations', 'favourites'] loop
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format('create trigger %I_touch before update on %I for each row execute function touch_changed_at()', t, t);
  end loop;
  foreach t in array array['menu_items', 'refill_stations'] loop
    execute format('drop trigger if exists %I_tombstone on %I', t, t);
    execute format('create trigger %I_tombstone after delete on %I for each row execute function record_deletion()', t, t);
  end loop;
end $$;
