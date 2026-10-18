import seed from '../../seed/locations.json';
import coords from '../../seed/coordinates.json';
import { normalizeSeed, type CoordFile, type SeedFile } from '../shared/normalize';

export function seedData() {
  return normalizeSeed(seed as SeedFile, coords as CoordFile);
}
