import { layers, namedFlavor } from '@protomaps/basemaps';
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { SATELLITE_ATTRIBUTION, SATELLITE_URL } from '../config';
import { WDW_BBOX } from '../shared/parks';

export const PMTILES_PATH = '/tiles/wdw.pmtiles';

/** Map ground colour, also the app's map placeholder (styles/app.css --map). */
export const PAPER = '#EEE8DA';

/** Protomaps "light", re-inked in the app's palette: paper land, soft lagoon water, sage parks. */
const TWILIGHT = {
  ...namedFlavor('light'),
  background: PAPER,
  earth: PAPER,
  park_a: '#D8E5CC',
  park_b: '#CFE0C3',
  wood_a: '#D3E1C6',
  wood_b: '#C9DABB',
  scrub_a: '#DCE6CF',
  scrub_b: '#D3DFC4',
  zoo: '#D8E5CC',
  water: '#BFD6E4',
  pedestrian: '#F7F2E8',
  buildings: '#E2D9C6',
  minor_a: '#FFFFFF',
  minor_b: '#FFFFFF',
  minor_service: '#FBF8F1',
  other: '#FBF8F1',
  major: '#FFFFFF',
  highway: '#F3E3BF',
  railway: '#C9BEA8',
  boundaries: '#C9BEA8',
};

const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

/**
 * Base map. With the self-hosted PMTiles extract it's a vector map that works
 * offline; without it, OSM raster tiles (the tiles you view are cached).
 * Label layers are dropped: they need glyph files from a CDN, and the pins
 * carry their own labels.
 */
export function buildStyle(hasPmtiles: boolean): StyleSpecification {
  const base: StyleSpecification = hasPmtiles
    ? {
        version: 8,
        sources: {
          protomaps: {
            type: 'vector',
            url: `pmtiles://${location.origin}${PMTILES_PATH}`,
            attribution: `<a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a> ${OSM_ATTRIBUTION}`,
          },
        },
        layers: (layers('protomaps', TWILIGHT, { lang: 'en' }) as LayerSpecification[]).filter((l) => l.type !== 'symbol'),
      }
    : {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 19,
            attribution: OSM_ATTRIBUTION,
          },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': PAPER } },
          // Warm, quieter OSM raster so the gold-and-navy pins lead.
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
            paint: { 'raster-saturation': -0.45, 'raster-contrast': -0.08, 'raster-brightness-min': 0.08, 'raster-hue-rotate': 8 },
          },
        ],
      };

  base.sources.satellite = {
    type: 'raster',
    tiles: [SATELLITE_URL],
    tileSize: 256,
    maxzoom: 19,
    attribution: SATELLITE_ATTRIBUTION,
  };
  base.layers.push({ id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } });
  return base;
}

/** Keep panning inside WDW, with a little slack. */
export const MAX_BOUNDS: [[number, number], [number, number]] = [
  [WDW_BBOX[0] - 0.03, WDW_BBOX[1] - 0.03],
  [WDW_BBOX[2] + 0.03, WDW_BBOX[3] + 0.03],
];
