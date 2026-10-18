-- Extra photos per location (trip shots and freely licensed images), each
-- with its credit line. hero_path stays the cover photo.
alter table locations add column if not exists photos jsonb not null default '[]'::jsonb;
