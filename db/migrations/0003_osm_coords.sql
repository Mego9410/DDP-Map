-- Pins can now come from OpenStreetMap (npm run pins) as well as Google Places.
alter table locations drop constraint if exists locations_coord_source_check;
alter table locations add constraint locations_coord_source_check
  check (coord_source in ('approx', 'places', 'osm', 'manual'));
