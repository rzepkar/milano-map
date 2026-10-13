```bash
npm install
# pmtiles-CLI von https://github.com/protomaps/go-pmtiles/releases laden und
# pmtiles.exe (Windows) bzw. pmtiles (macOS/Linux) in den Projektordner legen
npm run basemap          # erzeugt public/milano.pmtiles (Mailand, bis Zoom 14)
npm run dev              # lokal auf http://localhost:5173
```
POI stehen in `public/data/pois.geojson`. Bearbeiten in QGIS (GeoJSON-Layer, EPSG:4326) oder direkt als Text.

| Attribut | Bedeutung |
| --- | --- |
| `name` | Name des Ortes (Pflicht) |
| `kategorie` | `restaurant`, `cafe`, `bar`, `sehenswuerdigkeit`, `park`, `shop`, `sonstiges` |
| `sterne` | Eigene Bewertung 1 bis 5, auch 4.5 (optional) |
| `notiz` | Freitext |
| `datum` | Besuch als `JJJJ-MM-TT` |
| `url` | Website (nur `http`/`https`) |
| `beispiel` | `true` markiert Beispieleinträge, einfach entfernen |

Neue Kategorien: in `src/categories.ts` ergänzen (Label und Farbe).

## Aufbau

- `src/basemap.ts`: Kartenstil (Protomaps, hell und dunkel, 3D-Gebäude ab Zoom 15)
- `src/categories.ts`: Kategorien und Farben
- `src/main.ts`: Karte, Marker-Layer mit Clustering, Filter, Suche, Detailansicht
- `src/style.css`: Oberfläche
- `scripts/extract-basemap.mjs`: Kartenausschnitt aus dem Protomaps-Build

Kartendaten © OpenStreetMap-Mitwirkende, Basiskarte von Protomaps.
