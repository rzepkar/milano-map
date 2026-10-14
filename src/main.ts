import '@fontsource-variable/archivo/wdth.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';

import {
  AttributionControl,
  GeolocateControl,
  Map as MapLibreMap,
  addProtocol,
  setWorkerUrl,
} from 'maplibre-gl';
// MapLibre 6 sucht seinen Worker relativ zum Bundle. Mit Vite (Dev wie Build) liegt er dort nicht,
// deshalb wird er hier explizit als Asset eingebunden.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { GeoJSONSource } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import type { Feature, FeatureCollection, Point } from 'geojson';

import { BOUNDS, buildStyle } from './basemap';
import { KATEGORIEN, KATEGORIE_ORDER, colorExpression, isKategorie } from './categories';
import type { Kategorie } from './categories';

// ---------------------------------------------------------------- Typen & Zustand

interface PoiProps {
  id: string;
  name: string;
  kategorie: Kategorie;
  sterne?: number;
  notiz?: string;
  datum?: string;
  url?: string;
  beispiel?: boolean;
}
type Poi = Feature<Point, PoiProps>;

const state = {
  kategorien: new Set<Kategorie>(),
  minSterne: 0,
  selectedId: null as string | null,
};
let pois: Poi[] = [];

const BASE = import.meta.env.BASE_URL;
const PMTILES_URL = new URL(`${BASE}milano.pmtiles`, window.location.origin).href;

// ---------------------------------------------------------------- Kleine Helfer

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const STAR_SVG =
  '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.8l2.4 5.2 5.7.7-4.2 3.9 1.1 5.6L10 14.4 4.9 17.2 6 11.6 1.8 7.7l5.7-.7z"/></svg>';

function starIcon(): HTMLSpanElement {
  const span = el('span', 'star-icon');
  span.innerHTML = STAR_SVG;
  return span;
}

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const formatStars = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString('de-DE'));

function formatMonth(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(d);
}

function safeUrl(raw?: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

function roundel(p: PoiProps, className = ''): HTMLSpanElement {
  const r = el('span', `roundel ${className}`.trim(), p.sterne ? formatStars(p.sterne) : '');
  r.style.setProperty('--c', KATEGORIEN[p.kategorie].color);
  return r;
}

function starsRow(value: number): HTMLElement {
  const wrap = el('span', 'stars');
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', `${formatStars(value)} von 5 Sternen`);
  wrap.style.setProperty('--v', String(value));
  const base = el('span', 'stars-row');
  const fill = el('span', 'stars-row stars-fill');
  for (let i = 0; i < 5; i++) {
    base.append(starIcon());
    fill.append(starIcon());
  }
  wrap.append(base, fill);
  return wrap;
}

let toastTimer = 0;
function showToast(message: string) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = el('div', 'toast');
    toast.id = 'toast';
    toast.setAttribute('role', 'status');
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast?.classList.remove('show'), 6000);
}

// ---------------------------------------------------------------- Karte

setWorkerUrl(workerUrl);

const protocol = new Protocol();
addProtocol('pmtiles', protocol.tile);

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const mobileQuery = window.matchMedia('(max-width: 719px)');
const hadHash = Boolean(window.location.hash);

const map = new MapLibreMap({
  container: 'map',
  style: buildStyle(darkQuery.matches, PMTILES_URL),
  center: [9.19, 45.4642],
  zoom: hadHash ? 12.6 : 11.7,
  minZoom: 9.5,
  maxZoom: 19,
  maxBounds: BOUNDS,
  maxPitch: 60,
  hash: true,
  attributionControl: false,
});

map.addControl(new AttributionControl({ compact: true }), 'bottom-left');
map.addControl(
  new GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
  }),
  'bottom-right',
);

// Ein einziger Einstieg beim Laden: sanft auf die Stadt zoomen.
map.once('load', () => {
  if (!hadHash) map.easeTo({ zoom: 12.6, duration: 1800 });
});

let basemapWarned = false;
map.on('error', (e) => {
  // Quellenfehler tragen zur Laufzeit eine sourceId, die der Typ nicht kennt.
  const { sourceId } = e as unknown as { sourceId?: string };
  if (basemapWarned || sourceId !== 'protomaps') return;
  basemapWarned = true;
  showToast('Basiskarte fehlt. Mit „npm run basemap“ erzeugen, Details in der README.');
});

// Hell/Dunkel folgt dem System. diff:false erzwingt ein vollständiges Neuladen, damit
// „style.load“ erneut feuert und die POI-Layer wieder angelegt werden.
darkQuery.addEventListener('change', () => {
  map.setStyle(buildStyle(darkQuery.matches, PMTILES_URL), { diff: false });
});

// ---------------------------------------------------------------- POI-Layer

const HAS_RATING = ['>', ['coalesce', ['get', 'sterne'], 0], 0];

function visiblePois(): Poi[] {
  return pois.filter((p) => {
    const { kategorie, sterne } = p.properties;
    if (state.kategorien.size && !state.kategorien.has(kategorie)) return false;
    if (state.minSterne && (sterne ?? 0) < state.minSterne) return false;
    return true;
  });
}

function collection(features: Poi[]): FeatureCollection<Point, PoiProps> {
  return { type: 'FeatureCollection', features };
}

function setupPoiLayers() {
  if (map.getSource('pois')) return;

  map.addSource('pois', {
    type: 'geojson',
    data: collection(visiblePois()),
  });

  // Halo um den ausgewählten Ort.
  map.addLayer({
    id: 'poi-selected',
    type: 'circle',
    source: 'pois',
    filter: ['==', ['get', 'id'], state.selectedId ?? ''],
    paint: {
      'circle-color': colorExpression() as never,
      'circle-opacity': 0.28,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 14, 14, 22, 18, 28],
    },
  });

  map.addLayer({
    id: 'poi-points',
    type: 'circle',
    source: 'pois',
    // Bei dichten Punkten liegt der besser bewertete Ort oben.
    layout: { 'circle-sort-key': ['coalesce', ['get', 'sterne'], 0] },
    paint: {
      'circle-color': colorExpression() as never,
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10,
        ['case', HAS_RATING, 7, 4],
        14,
        ['case', HAS_RATING, 12, 7],
        18,
        ['case', HAS_RATING, 16, 9],
      ] as never,
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#FFFFFF',
    },
  });

  // Sterne als Zahl im Marker: eine Ebene, kein HTML pro Punkt.
  map.addLayer({
    id: 'poi-stars',
    type: 'symbol',
    source: 'pois',
    minzoom: 12,
    layout: {
      'symbol-sort-key': ['coalesce', ['get', 'sterne'], 0],
      'text-field': ['to-string', ['coalesce', ['get', 'sterne'], '']],
      'text-font': ['Noto Sans Medium'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 12, 9, 14, 13, 18, 17],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-pitch-alignment': 'viewport',
    },
    paint: { 'text-color': '#FFFFFF' },
  });
}

map.on('style.load', setupPoiLayers);

map.on('mouseenter', 'poi-points', () => (map.getCanvas().style.cursor = 'pointer'));
map.on('mouseleave', 'poi-points', () => (map.getCanvas().style.cursor = ''));

map.on('click', (e) => {
  if (!map.getLayer('poi-points')) return;
  // Kleine Toleranz um den Klickpunkt, damit Marker auch mit dem Finger treffbar sind.
  const box: [[number, number], [number, number]] = [
    [e.point.x - 10, e.point.y - 10],
    [e.point.x + 10, e.point.y + 10],
  ];
  const hit = map.queryRenderedFeatures(box, { layers: ['poi-points'] })[0];
  if (!hit) {
    closeSheet();
    return;
  }
  const id = hit.properties?.id;
  if (typeof id === 'string') select(id);
});

// ---------------------------------------------------------------- Filter

function refresh() {
  const visible = visiblePois();
  (map.getSource('pois') as GeoJSONSource | undefined)?.setData(collection(visible));
  $('count').textContent = `${visible.length} ${visible.length === 1 ? 'Ort' : 'Orte'}`;
}

function buildChips(present: Set<Kategorie>) {
  const wrap = $('chips');
  wrap.replaceChildren();

  for (const k of KATEGORIE_ORDER) {
    if (!present.has(k)) continue;
    const chip = el('button', 'chip');
    chip.type = 'button';
    chip.setAttribute('aria-pressed', 'false');
    chip.style.setProperty('--c', KATEGORIEN[k].color);
    chip.append(el('span', 'chip-dot'), document.createTextNode(KATEGORIEN[k].label));
    chip.addEventListener('click', () => {
      if (!state.kategorien.delete(k)) state.kategorien.add(k);
      chip.setAttribute('aria-pressed', String(state.kategorien.has(k)));
      refresh();
    });
    wrap.append(chip);
  }

  const sep = el('span', 'chip-sep');
  sep.setAttribute('aria-hidden', 'true');
  wrap.append(sep);

  for (const n of [3, 4, 5]) {
    const chip = el('button', 'chip chip-star');
    chip.type = 'button';
    chip.dataset.min = String(n);
    chip.setAttribute('aria-pressed', 'false');
    chip.setAttribute('aria-label', n === 5 ? 'Nur 5 Sterne' : `Ab ${n} Sternen`);
    chip.append(starIcon(), document.createTextNode(n === 5 ? '5' : `${n}+`));
    chip.addEventListener('click', () => {
      state.minSterne = state.minSterne === n ? 0 : n;
      for (const c of wrap.querySelectorAll<HTMLButtonElement>('.chip-star')) {
        c.setAttribute('aria-pressed', String(Number(c.dataset.min) === state.minSterne));
      }
      refresh();
    });
    wrap.append(chip);
  }
}

// ---------------------------------------------------------------- Detailansicht

const sheet = $('sheet');
const sheetBody = el('div', 'sheet-body');

function buildSheetShell() {
  const grab = el('div', 'grab');
  const close = el('button', 'close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Schließen');
  close.innerHTML =
    '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  close.addEventListener('click', closeSheet);
  sheet.append(grab, close, sheetBody);
  sheet.hidden = false;
  sheet.inert = true;
  enableSheetDrag(grab);
}

// Nach unten wischen schließt die Detailansicht.
function enableSheetDrag(handle: HTMLElement) {
  let startY = 0;
  let dy = 0;
  let dragging = false;
  handle.addEventListener('pointerdown', (e) => {
    dragging = true;
    startY = e.clientY;
    dy = 0;
    handle.setPointerCapture(e.pointerId);
    sheet.style.transition = 'none';
  });
  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = '';
    if (dy > 80) {
      closeSheet();
      requestAnimationFrame(() => (sheet.style.transform = ''));
    } else {
      sheet.style.transform = '';
    }
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

function renderSheet(poi: Poi) {
  const p = poi.properties;
  const [lng, lat] = poi.geometry.coordinates;

  const head = el('div', 'sheet-head');
  const titles = el('div', 'sheet-titles');
  titles.append(el('h2', 'sheet-name', p.name), el('p', 'sheet-cat', KATEGORIEN[p.kategorie].label));
  head.append(roundel(p, 'roundel-lg'), titles);

  const parts: Node[] = [head];

  if (p.sterne) {
    const rating = el('div', 'rating');
    rating.append(starsRow(p.sterne), el('span', 'rating-text', `${formatStars(p.sterne)} von 5`));
    parts.push(rating);
  }
  if (p.notiz) parts.push(el('p', 'sheet-note', p.notiz));

  const month = formatMonth(p.datum);
  if (month) parts.push(el('p', 'sheet-meta', `Besucht im ${month}`));
  if (p.beispiel) {
    parts.push(el('p', 'sheet-meta sheet-sample', 'Beispieleintrag, bitte durch einen eigenen ersetzen.'));
  }

  const actions = el('div', 'actions');
  const route = el('a', 'btn btn-primary', 'Route');
  route.href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  route.target = '_blank';
  route.rel = 'noopener noreferrer';
  actions.append(route);
  const site = safeUrl(p.url);
  if (site) {
    const link = el('a', 'btn', 'Website');
    link.href = site;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    actions.append(link);
  }
  parts.push(actions);

  sheetBody.replaceChildren(...parts);
  sheet.scrollTop = 0;
}

function cameraPadding() {
  return mobileQuery.matches
    ? { top: 96, right: 0, left: 0, bottom: sheet.offsetHeight }
    : { top: 0, right: 0, bottom: 0, left: 392 };
}

function highlight(id: string | null) {
  if (map.getLayer('poi-selected')) map.setFilter('poi-selected', ['==', ['get', 'id'], id ?? '']);
}

function select(id: string) {
  const poi = pois.find((p) => p.properties.id === id);
  if (!poi) return;
  state.selectedId = id;
  highlight(id);
  renderSheet(poi);
  sheet.inert = false;
  sheet.classList.add('open');
  map.easeTo({
    center: poi.geometry.coordinates as [number, number],
    zoom: Math.max(map.getZoom(), 15),
    padding: cameraPadding(),
    duration: 650,
  });
}

function closeSheet() {
  if (!sheet.classList.contains('open')) return;
  sheet.classList.remove('open');
  sheet.inert = true;
  state.selectedId = null;
  highlight(null);
  map.easeTo({ padding: { top: 0, right: 0, bottom: 0, left: 0 }, duration: 300 });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
});

// ---------------------------------------------------------------- Suche

function setupSearch() {
  const input = $<HTMLInputElement>('search');
  const list = $('results');

  const hide = () => {
    list.hidden = true;
    list.replaceChildren();
  };

  const render = () => {
    const q = normalize(input.value.trim());
    if (!q) return hide();
    const found = pois
      .filter((p) => normalize(`${p.properties.name} ${p.properties.notiz ?? ''}`).includes(q))
      .slice(0, 6);
    list.replaceChildren();
    if (!found.length) {
      list.append(el('li', 'result-empty', 'Kein Ort gefunden'));
    }
    for (const poi of found) {
      const li = el('li');
      const btn = el('button', 'result');
      btn.type = 'button';
      const text = el('span', 'result-text');
      text.append(
        el('span', 'result-name', poi.properties.name),
        el('span', 'result-cat', KATEGORIEN[poi.properties.kategorie].label),
      );
      btn.append(roundel(poi.properties), text);
      btn.addEventListener('click', () => {
        input.value = '';
        input.blur();
        hide();
        select(poi.properties.id);
      });
      li.append(btn);
      list.append(li);
    }
    list.hidden = false;
  };

  input.addEventListener('input', render);
  input.addEventListener('focus', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      hide();
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!(e.target as Element).closest('.search')) hide();
  });
}

// ---------------------------------------------------------------- Daten laden

async function loadPois() {
  const res = await fetch(`${BASE}data/pois.geojson`);
  if (!res.ok) throw new Error(`pois.geojson: HTTP ${res.status}`);
  const data = (await res.json()) as FeatureCollection<Point, Record<string, unknown>>;

  pois = data.features
    .filter((f) => f.geometry?.type === 'Point' && typeof f.properties?.name === 'string')
    .map((f, i) => {
      const raw = f.properties;
      const sterne = typeof raw.sterne === 'number' && raw.sterne > 0 ? Math.min(5, raw.sterne) : undefined;
      return {
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          id: String(raw.id ?? i),
          name: raw.name as string,
          kategorie: isKategorie(raw.kategorie) ? raw.kategorie : 'other',
          sterne,
          notiz: typeof raw.notiz === 'string' ? raw.notiz : undefined,
          datum: typeof raw.datum === 'string' ? raw.datum : undefined,
          url: typeof raw.url === 'string' ? raw.url : undefined,
          beispiel: raw.beispiel === true,
        },
      } satisfies Poi;
    });

  buildChips(new Set(pois.map((p) => p.properties.kategorie)));
  refresh();
}

buildSheetShell();
setupSearch();
loadPois().catch(() => showToast('Orte konnten nicht geladen werden (data/pois.geojson).'));
