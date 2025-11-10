// js/main.js — app bootstrap & wiring (single source of truth)

import { setupThemeToggle, setupAdvancedToggle, setupGpxDropzone, showMainSections } from './ui.js';
import { bindIoAPI, readFileAsText, wireSaveLoadExport, restorePlanFromJSON } from './io.js';
import { bindTableAPI, renderRoadbooksTable, updateSummaryCard, wireTableFades, exportRoadbooksCsv } from './table.js';
import { bindMapAPI, ensureMap, drawPolyline, clearMarkers, addRoadbookIndex, refreshTiles, invalidateMapSize, refitToTrack } from './map.js';
import { parseGPXToSegments, parseGPXRoadbooks } from './gpx.js';
import { buildTrackFromSegments, nearestIndexOnTrack } from './track.js';
import { toPosNum, toNonNegNum, escapeHtml } from './utils.js';

//
// ---------- DOM ----------
const outputEl      = document.getElementById('output');
const roadbooksEl   = document.getElementById('roadbooks');
const calcBtn       = document.getElementById('calculateBtn') || document.getElementById('processBtn');
const clearBtn      = document.getElementById('clearRoadbooksBtn');
const saveBtn       = document.getElementById('savePlanBtn');
const loadBtn       = document.getElementById('loadPlanBtn');
const loadInput     = document.getElementById('loadPlanInput');
const exportCsvBtn  = document.getElementById('exportCsvBtn');
const printBtn      = document.getElementById('printBtn');
const activitySel   = document.getElementById('activityType');
const showAdvChk    = document.getElementById('showAdvanced');

//
// ---------- App state (single source of truth) ----------
let trackLatLngs   = [];  // [[lat, lon], ...] resampled
let trackBreakIdx  = [];
let cumDistKm      = [0];
let cumAscentM     = [0];
let cumDescentM    = [0];
let cumTimeH       = [0];

let roadbookIdx      = [];            // indices into trackLatLngs
let roadbookLabels   = new Map();     // idx -> label
let legLabels        = new Map();     // "a|b" -> custom leg name
let legStopsMin      = new Map();     // "a|b" -> minutes
let legCondPct       = new Map();     // "a|b" -> percent (may be negative)
let legCritical      = new Map();     // "a|b" -> boolean
let legObservations  = new Map();     // "a|b" -> string

let lastGpxText = '';
let lastGpxName = '';

function getLegKey(a,b){ return `${a}|${b}`; }
function getWaypointName(idx) {
  if (roadbookLabels.has(idx)) return roadbookLabels.get(idx);
  const pos = roadbookIdx.indexOf(idx);
  return pos >= 0 ? `WP ${pos + 1}` : `WP ${idx}`;
}
function setWaypointName(idx, name) {
  const clean = String(name || '').trim();
  if (clean) roadbookLabels.set(idx, clean); else roadbookLabels.delete(idx);
}
function setRoadbookLabel(idx, label) { setWaypointName(idx, label); }

//
// ---------- Wire modules to our state ----------

// Table needs read access and the writable per-leg maps
bindTableAPI({
  roadbooksEl,
  outputEl,
  // readers
  getTrackLatLngs: () => trackLatLngs,
  getCumDist:  () => cumDistKm,
  getCumAsc:   () => cumAscentM,
  getCumDes:   () => cumDescentM,
  getCumTime:  () => cumTimeH,
  // leg + labels maps
  roadbookIdx,
  roadbookLabels,
  legLabels,
  legStopsMin,
  legCondPct,
  legCritical,
  legObservations,
  // helpers
  getWaypointName,
  getLegKey,
  getDefaultLegLabel: (a,b) => `${getWaypointName(a)} \u2192 ${getWaypointName(b)}`,
  onRender: () => wireTableFades()
});

// Map needs accessors and callbacks
bindMapAPI({
  getTrackLatLngs: () => trackLatLngs,
  roadbookIdx,
  roadbookLabels,
  renderRoadbooksTable,
  nearestIndexOnTrack,
  escapeHtml,
  getWaypointName,
  setWaypointName,
  setRoadbookLabel,
  confirmDelete: (msg) => window.confirm(msg)
});

// IO needs hooks into our processing + state getters/setters
bindIoAPI({
  getLastGpxText: () => lastGpxText,
  setLastGpxText: (t) => { lastGpxText = String(t || ''); },
  getLastGpxName: () => lastGpxName,
  setLastGpxName: (n) => { lastGpxName = String(n || ''); },

  // called by IO -> we do the real processing here (no globals)
  processGpxText: async (gpxText, importRoadbooks=true) => {
    await processGpxText(gpxText, importRoadbooks);
  },

  addRoadbookIndex: (i, opts) => addRoadbookIndex(i, opts),
  clearMarkers: () => clearMarkers(),

  renderRoadbooksTable,
  updateSummaryCard,
  showMainSections,
  exportRoadbooksCsv,
  nearestIndexOnTrack
});

wireSaveLoadExport();

//
// ---------- Boot UI bits ----------
setupThemeToggle({
  toggleBtn: document.getElementById('themeToggle'),
  logoEl: document.getElementById('brandLogo'),
  lightLogoSrc: 'assets/timewisegpx_logo_light.svg',
  darkLogoSrc: 'assets/timewisegpx_logo_dark.svg'
});
setupAdvancedToggle({ checkbox: showAdvChk, settingsCard: document.getElementById('settingsCard') });
setupGpxDropzone({
  dropEl: document.getElementById('gpxDrop'),
  fileInput: document.getElementById('gpxFile'),
  selectBtn: document.getElementById('selectGpxBtn'),
  statusEl: document.getElementById('gpxStatus'),
  processBtn: calcBtn,
  clearBtn: document.getElementById('clearRoadbooksBtn')
});

//
// ---------- Process / Clear buttons ----------
if (calcBtn) {
  calcBtn.addEventListener('click', async () => {
    const fileInput = document.getElementById('gpxFile');
    if (!fileInput?.files?.length) { alert('Please upload a GPX file.'); return; }
    const file = fileInput.files[0];
    lastGpxName = file.name.replace(/\.[^/.]+$/, '');

    const gpxText = await readFileAsText(file);
    lastGpxText = String(gpxText || '');
    await processGpxText(lastGpxText, (document.getElementById('importRoadbooks')?.checked ?? true));
    showMainSections(true);
    setTimeout(() => {
      invalidateMapSize();
      refreshTiles();
    }, 0);
  });
}

if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    if (!trackLatLngs.length) return;
    clearMarkers();
    // reset state
    roadbookIdx.length = 0;
    roadbookLabels.clear();
    legLabels.clear();
    legStopsMin.clear();
    legCondPct.clear();
    legCritical.clear();
    legObservations.clear();

    // re-add start/finish
    addRoadbookIndex(0, { noRender: true, label: 'Start',  locked: true });
    addRoadbookIndex(trackLatLngs.length - 1, { noRender: true, label: 'Finish', locked: true });
    renderRoadbooksTable();
  });
}

//
// ---------- Core processor (was a global; now lives here) ----------
async function processGpxText(gpxText, importRoadbooks = true) {
  // read settings from DOM
  const spacingM      = toPosNum(document.getElementById('spacingM')?.value, 5);
  const smoothWinM    = toPosNum(document.getElementById('smoothWinM')?.value, 15);
  const elevDeadbandM = toNonNegNum(document.getElementById('elevDeadbandM')?.value, 2);
  const speedFlatKmh  = toPosNum(document.getElementById('speedFlatKmh')?.value, 4);
  const speedVertMh   = toPosNum(document.getElementById('speedVertMh')?.value, 300);
  const downhillFactor = toPosNum(document.getElementById('downhillFactor')?.value, 0.6667);

  const segments = parseGPXToSegments(gpxText);
  if (!segments.length) { alert('No track segments found in GPX.'); return; }

  // build track + cumulatives
  const built = buildTrackFromSegments(segments, {
    spacingM, smoothWinM, elevDeadbandM,
    speedFlatKmh, speedVertMh, downhillFactor
  });

  trackLatLngs = built.trackLatLngs;
  trackBreakIdx = built.breakIdx;
  cumDistKm   = built.cumDistKm;
  cumAscentM  = built.cumAscentM;
  cumDescentM = built.cumDescentM;
  cumTimeH    = built.cumTimeH;

  // map
  ensureMap();
  drawPolyline(trackLatLngs);
  clearMarkers();

  // import roadbooks if requested
  roadbookIdx.length = 0;
  roadbookLabels.clear();

  if (importRoadbooks) {
    const wpts = parseGPXRoadbooks(gpxText);
    // snap unique labelled points to nearest resampled index
    const seen = new Set();
    for (const w of wpts) {
      const idx = nearestIndexOnTrack([w.lat, w.lon], trackLatLngs);
      if (seen.has(idx)) continue;
      seen.add(idx);
      addRoadbookIndex(idx, { noRender: true, label: w.name || '' });
    }
  }

  // always ensure start/finish
  addRoadbookIndex(0, { noRender: true, label: 'Start', locked: true });
  addRoadbookIndex(trackLatLngs.length - 1, { noRender: true, label: 'Finish', locked: true });

  renderRoadbooksTable();
  updateSummaryCard();

  showMainSections(true);

  setTimeout(() => {
    invalidateMapSize();
    refreshTiles();
    refitToTrack([24, 24]);
  }, 0);
  
  window.addEventListener('resize', () => {
    invalidateMapSize();
    refitToTrack([24, 24]);
  }, { passive: true });



  exportCsvBtn.disabled = false;
  saveBtn && (saveBtn.disabled = false);
  setTimeout(() => { printBtn && (printBtn.disabled = false); }, 0);
}

window.addEventListener('resize', () => {
  invalidateMapSize();
}, { passive: true });


//
// ---------- CSV & Print wiring ----------
exportCsvBtn?.addEventListener('click', () => {
  const csv = exportRoadbooksCsv();
  if (!csv) return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(lastGpxName || 'plan')}-roadbooks.csv`;
  a.click();
});

printBtn?.addEventListener('click', () => window.print());

// fades need to be attached once
wireTableFades();
