// js/main.js — app bootstrap & wiring (single source of truth)

import { setupThemeToggle, setupAdvancedToggle, setupGpxDropzone, showMainSections } from './ui.js';
import { bindIoAPI, readFileAsText, wireSaveLoadExport, restorePlanFromJSON } from './io.js';
import { bindTableAPI, renderRoadbooksTable, updateSummaryCard, wireTableFades, exportRoadbooksCsv } from './table.js';
import { bindMapAPI, ensureMap, drawPolyline, clearMarkers, addRoadbookIndex, refreshTiles, invalidateMapSize, refitToTrack, ensureLabelPopup, getMarkers } from './map.js';
import { parseGPXToSegments, parseGPXRoadbooks } from './gpx.js';
import { buildTrackFromSegments, nearestIndexOnTrack } from './track.js';
import { toPosNum, toNonNegNum, escapeHtml } from './utils.js';
import { initI18n, addLanguageChangeListener, t } from './i18n.js';
import { ACTIVITY_PRESETS } from './config.js';

//
// ---------- DOM ----------
const outputEl      = document.getElementById('output');
const roadbooksEl   = document.getElementById('roadbooks');
const clearBtn      = document.getElementById('clearRoadbooksBtn');
const saveBtn       = document.getElementById('savePlanBtn');
const loadBtn       = document.getElementById('loadPlanBtn');
const loadInput     = document.getElementById('loadPlanInput');
const exportCsvBtn  = document.getElementById('exportCsvBtn');
const printBtn      = document.getElementById('printBtn');
const activitySel   = document.getElementById('activityType');
const showAdvChk    = document.getElementById('showAdvanced');
const languageSelect = document.getElementById('languageSelector');
const updateSettingsBtn = document.getElementById('updateSettingsBtn');

initI18n({ selectorEl: languageSelect });

function applyActivityPreset(kind) {
  const preset = ACTIVITY_PRESETS[kind];
  if (!preset) return;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  setVal('spacingM', preset.spacing);
  setVal('smoothWinM', preset.smooth);
  setVal('speedFlat', preset.speedFlat);
  setVal('speedVert', preset.speedVert);
  setVal('downhillFactor', preset.dhf);
}

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

const getImportRoadbooksPref = () => (document.getElementById('importRoadbooks')?.checked ?? true);
const hasActivePlan = () => trackLatLngs.length > 0 || roadbookIdx.length > 0;

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
  getActivityType: () => activitySel?.value || 'hike',
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
  saveBtn,
  loadBtn,
  loadInput,
  exportCsvBtn,
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
  nearestIndexOnTrack,

  // shared state (allow IO to read/write live data)
  getTrackLatLngs: () => trackLatLngs,
  getCumDist: () => cumDistKm,
  getCumAsc: () => cumAscentM,
  getCumDes: () => cumDescentM,
  getCumTime: () => cumTimeH,
  roadbookIdx,
  roadbookLabels,
  legLabels,
  legStopsMin,
  legCondPct,
  legCritical,
  legObservations
});

wireSaveLoadExport();

//
// ---------- Boot UI bits ----------
setupThemeToggle({
  toggleBtn: document.getElementById('themeToggle'),
  logoEl: document.getElementById('appLogo'),
  lightLogoSrc: 'assets/timewisegpx_logo.svg',
  darkLogoSrc: 'assets/timewisegpx_logo_dark.svg'
});
setupAdvancedToggle({ checkbox: showAdvChk, settingsCard: document.getElementById('settingsCard') });
setupGpxDropzone({
  dropEl: document.getElementById('gpxDrop'),
  fileInput: document.getElementById('gpxFile'),
  selectBtn: document.getElementById('selectGpxBtn'),
  statusEl: document.getElementById('gpxStatus'),
  onBeforeFileAccept: () => confirmReplaceIfNeeded(),
  onFileReady: (file) => handleNewGpxFile(file)
});

document.getElementById('openGpxUploader')?.addEventListener('click', () => {
  document.getElementById('selectGpxBtn')?.click();
});

const tabButtons = Array.from(document.querySelectorAll('[data-panel-target]'));
if (tabButtons.length) {
  tabButtons.forEach(btn => btn.addEventListener('click', () => {
    const target = btn.dataset.panelTarget;
    tabButtons.forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.drawer-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === target);
    });
  }));
}

addLanguageChangeListener(() => {
  if (trackLatLngs.length > 0) {
    if (roadbookIdx.includes(0)) {
      roadbookLabels.set(0, t('map.start'));
    }
    const lastIdx = trackLatLngs.length - 1;
    if (roadbookIdx.includes(lastIdx)) {
      roadbookLabels.set(lastIdx, t('map.finish'));
    }
    getMarkers().forEach(marker => ensureLabelPopup(marker));
  }
  renderRoadbooksTable();
  updateSummaryCard();
});

async function confirmReplaceIfNeeded() {
  if (!hasActivePlan()) return true;
  return window.confirm(t('gpx.replaceWarning'));
}

async function handleNewGpxFile(file) {
  lastGpxName = file?.name ? file.name.replace(/\.[^/.]+$/, '') : '';
  const gpxText = await readFileAsText(file);
  lastGpxText = String(gpxText || '');
  await processGpxText(lastGpxText, getImportRoadbooksPref());
}

if (activitySel) {
  applyActivityPreset(activitySel.value);
  activitySel.addEventListener('change', () => {
    applyActivityPreset(activitySel.value);
    updateSummaryCard();
  });
}

updateSettingsBtn?.addEventListener('click', async () => {
  if (!lastGpxText) { alert(t('settings.errors.noGpxLoaded')); return; }
  await processGpxText(lastGpxText, false, { preserveRoadbooks: true });
});

//
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    if (!trackLatLngs.length) return;
    const confirmClear = window.confirm(t('map.confirmClearRoadbooksDetail'));
    if (!confirmClear) return;
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
    addRoadbookIndex(0, { noRender: true, label: t('map.start'),  locked: true });
    addRoadbookIndex(trackLatLngs.length - 1, { noRender: true, label: t('map.finish'), locked: true });
    renderRoadbooksTable();
  });
}

function snapshotRoadbooks() {
  const markerMap = new Map(getMarkers().map(m => [m.__idx, m]));
  const waypoints = roadbookIdx.map(idx => ({
    coord: trackLatLngs[idx],
    label: roadbookLabels.get(idx) || '',
    locked: markerMap.get(idx)?.__locked || false
  }));

  const legs = [];
  for (let i = 0; i < roadbookIdx.length - 1; i++) {
    const key = getLegKey(roadbookIdx[i], roadbookIdx[i + 1]);
    legs.push({
      label: legLabels.get(key),
      stops: legStopsMin.get(key),
      cond: legCondPct.get(key),
      critical: legCritical.get(key),
      observations: legObservations.get(key)
    });
  }

  return { waypoints, legs };
}

function setIfDefined(map, key, value) {
  if (value === undefined) return;
  map.set(key, value);
}

function restoreRoadbooks(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.waypoints)) return;

  const seen = new Set();
  snapshot.waypoints.forEach(wp => {
    if (!wp || !wp.coord) return;
    const idx = nearestIndexOnTrack(wp.coord, trackLatLngs);
    if (seen.has(idx)) return;
    seen.add(idx);
    addRoadbookIndex(idx, { noRender: true, label: wp.label, locked: wp.locked });
  });

  if (trackLatLngs.length) {
    if (!seen.has(0)) addRoadbookIndex(0, { noRender: true, label: t('map.start'), locked: true });
    const lastIdx = trackLatLngs.length - 1;
    if (!seen.has(lastIdx)) addRoadbookIndex(lastIdx, { noRender: true, label: t('map.finish'), locked: true });
  }

  for (let i = 0; i < snapshot.legs.length && i < roadbookIdx.length - 1; i++) {
    const a = roadbookIdx[i];
    const b = roadbookIdx[i + 1];
    const key = getLegKey(a, b);
    const saved = snapshot.legs[i];
    setIfDefined(legLabels, key, saved?.label);
    setIfDefined(legStopsMin, key, saved?.stops);
    setIfDefined(legCondPct, key, saved?.cond);
    setIfDefined(legCritical, key, saved?.critical);
    setIfDefined(legObservations, key, saved?.observations);
  }
}

//
// ---------- Core processor (was a global; now lives here) ----------
async function processGpxText(gpxText, importRoadbooks = true, options = {}) {
  const { preserveRoadbooks = false } = options;
  const preserved = preserveRoadbooks ? snapshotRoadbooks() : null;
  // read settings from DOM
  const spacingM      = toPosNum(document.getElementById('spacingM')?.value, 5);
  const smoothWinM    = toPosNum(document.getElementById('smoothWinM')?.value, 15);
  const elevDeadbandM = toNonNegNum(document.getElementById('elevDeadbandM')?.value, 2);
  const speedFlatKmh  = toPosNum(document.getElementById('speedFlat')?.value, 4);
  const speedVertMh   = toPosNum(document.getElementById('speedVert')?.value, 300);
  const downhillFactor = toPosNum(document.getElementById('downhillFactor')?.value, 0.6667);
  const activity       = activitySel?.value || 'hike';

  const segments = parseGPXToSegments(gpxText);
  if (!segments.length) { alert(t('gpx.errors.noSegments')); return; }

  // build track + cumulatives
  const built = buildTrackFromSegments(segments, {
    spacingM, smoothWinM, elevDeadbandM,
    speedFlatKmh, speedVertMh, downhillFactor,
    activity
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
  legLabels.clear();
  legStopsMin.clear();
  legCondPct.clear();
  legCritical.clear();
  legObservations.clear();

  if (preserved) {
    restoreRoadbooks(preserved);
  } else if (importRoadbooks) {
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
  addRoadbookIndex(0, { noRender: true, label: t('map.start'), locked: true });
  addRoadbookIndex(trackLatLngs.length - 1, { noRender: true, label: t('map.finish'), locked: true });

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



  if (clearBtn) {
    clearBtn.disabled = trackLatLngs.length === 0;
  }
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
