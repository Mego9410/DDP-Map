import seed from '../../seed/locations.json';
import coords from '../../seed/coordinates.json';
import photos from '../../seed/photos.json';
import { normalizeSeed, type CoordFile, type PhotoManifest, type SeedFile } from '../shared/normalize';

export function seedData() {
  return normalizeSeed(seed as SeedFile, coords as CoordFile, [], photos as PhotoManifest);
}
