import { layers, namedFlavor } from '@protomaps/basemaps';
import type { Flavor } from '@protomaps/basemaps';
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';

// Ausschnitt, der in public/milano.pmtiles liegt (muss zu scripts/extract-basemap.sh passen).
export const BOUNDS: [[number, number], [number, number]] = [
  [8.95, 45.36],
  [9.4, 45.58],
];

const ASSETS = 'https://protomaps.github.io/basemaps-assets';

function flavor(dark: boolean): Flavor {
  if (dark) {
    return { ...namedFlavor('dark'), background: '#10161D', earth: '#161D25' };
  }
  // Kühles Nebelgrau statt des warmen Standards, Wasser leicht bläulich.
  return {
    ...namedFlavor('light'),
    background: '#E9ECEE',
    earth: '#EBEDEE',
    water: '#BCD6E2',
    park_a: '#D3E3CF',
    park_b: '#D3E3CF',
    buildings: '#DADFE3',
  };
}

export function buildStyle(dark: boolean, pmtilesUrl: string): StyleSpecification {
  const f = flavor(dark);
  const base = layers('protomaps', f) as LayerSpecification[];

  // 3D-Gebäude ab Zoom 15, direkt über den flachen Gebäudeflächen.
  const extrusion: LayerSpecification = {
    id: 'buildings-3d',
    type: 'fill-extrusion',
    source: 'protomaps',
    'source-layer': 'buildings',
    minzoom: 15,
    paint: {
      'fill-extrusion-color': f.buildings,
      'fill-extrusion-height': ['coalesce', ['get', 'height'], 8],
      'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
      'fill-extrusion-opacity': 0.85,
    },
  };
  const at = base.findIndex((l) => l.id === 'buildings');
  const firstSymbol = base.findIndex((l) => l.type === 'symbol');
  const index = at >= 0 ? at + 1 : firstSymbol >= 0 ? firstSymbol : base.length;
  base.splice(index, 0, extrusion);

  return {
    version: 8,
    glyphs: `${ASSETS}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${ASSETS}/sprites/v4/${dark ? 'dark' : 'light'}`,
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${pmtilesUrl}`,
        attribution:
          '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: base,
  };
}
