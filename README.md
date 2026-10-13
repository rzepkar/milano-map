# Milano, meine Orte

Private Karte von Mailand mit eigenen Orten und Sternebewertungen. Vektorkarte (MapLibre GL JS), Basiskarte als einzelne PMTiles-Datei im Repo, Hosting über GitHub Pages. Kein Server, keine API-Keys, keine Kosten.

## Einmalig einrichten

```bash
npm install
# pmtiles-CLI von https://github.com/protomaps/go-pmtiles/releases laden und
# pmtiles.exe (Windows) bzw. pmtiles (macOS/Linux) in den Projektordner legen
npm run basemap          # erzeugt public/milano.pmtiles (Mailand, bis Zoom 14)
npm run dev              # lokal auf http://localhost:5173
```

Ohne `public/milano.pmtiles` erscheinen die Punkte auf leerem Grund, die App zeigt dann einen Hinweis.

## Orte pflegen

Alle Orte stehen in `public/data/pois.geojson`. Bearbeiten in QGIS (GeoJSON-Layer, EPSG:4326) oder direkt als Text.

| Attribut | Bedeutung |
| --- | --- |
| `name` | Name des Ortes (Pflicht) |
| `kategorie` | `restaurant`, `cafe`, `bar`, `sehenswuerdigkeit`, `park`, `shop`, `sonstiges` |
| `sterne` | Eigene Bewertung 1 bis 5, auch 4.5 (optional) |
| `notiz` | Freitext |
| `datum` | Besuch als `JJJJ-MM-TT` |
| `url` | Website (nur `http`/`https`) |
| `beispiel` | `true` markiert Beispieleinträge, einfach entfernen |

Die acht mitgelieferten Orte sind Beispiele mit erfundenen Bewertungen. Ersetzen oder löschen.

Neue Kategorien: in `src/categories.ts` ergänzen (Label und Farbe).

## Veröffentlichen

1. Repo auf GitHub anlegen und pushen (Branch `main`).
2. Unter Settings, Pages, Source auf „GitHub Actions“ stellen.
3. Jeder Push baut und deployt über `.github/workflows/deploy.yml`.

`public/milano.pmtiles` muss mit eingecheckt werden. Bei Zoom 14 bleibt die Datei deutlich unter dem 100-MB-Limit von GitHub.

## Aufbau

- `src/basemap.ts`: Kartenstil (Protomaps, hell und dunkel, 3D-Gebäude ab Zoom 15)
- `src/categories.ts`: Kategorien und Farben
- `src/main.ts`: Karte, Marker-Layer mit Clustering, Filter, Suche, Detailansicht
- `src/style.css`: Oberfläche
- `scripts/extract-basemap.mjs`: Kartenausschnitt aus dem Protomaps-Build

Kartendaten © OpenStreetMap-Mitwirkende, Basiskarte von Protomaps.
