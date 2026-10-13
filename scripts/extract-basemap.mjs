// Schneidet Mailand aus dem Protomaps-OSM-Build aus und legt es als public/milano.pmtiles ab.
// Voraussetzung: pmtiles-CLI (pmtiles.exe im Projektordner oder im PATH).
// Ausschnitt anpassen: BBOX="west,süd,ost,nord" (muss zu BOUNDS in src/basemap.ts passen).
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';

const bbox = process.env.BBOX ?? '8.95,45.36,9.40,45.58';
const maxzoom = process.env.MAXZOOM ?? '14';
const out = 'public/milano.pmtiles';

try {
  execFileSync('pmtiles', ['version'], { stdio: 'ignore' });
} catch {
  console.error(
    'pmtiles-CLI nicht gefunden. Von https://github.com/protomaps/go-pmtiles/releases laden\n' +
      'und pmtiles.exe (Windows) beziehungsweise pmtiles in den Projektordner legen.',
  );
  process.exit(1);
}

mkdirSync('public', { recursive: true });

// Tägliche Builds: den neuesten der letzten Tage nehmen.
for (let back = 0; back <= 7; back++) {
  const day = new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10).replaceAll('-', '');
  const url = `https://build.protomaps.com/${day}.pmtiles`;
  console.log(`Versuche ${url}`);
  try {
    execFileSync('pmtiles', ['extract', url, out, `--bbox=${bbox}`, `--maxzoom=${maxzoom}`], {
      stdio: 'inherit',
    });
    const mb = (statSync(out).size / 1024 / 1024).toFixed(1);
    console.log(`Fertig: ${out} (${mb} MB)`);
    process.exit(0);
  } catch {
    // nächster Tag
  }
}

console.error('Kein Protomaps-Build gefunden. Aktuelle Builds: https://maps.protomaps.com/builds/');
process.exit(1);
