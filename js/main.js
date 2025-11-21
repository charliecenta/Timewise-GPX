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
const outputEl       = document.getElementById('output');
const roadbooksEl    = document.getElementById('roadbooks');
const clearBtn       = document.getElementById('clearRoadbooksBtn');
const saveBtn        = document.getElementById('savePlanBtn');
const loadBtn        = document.getElementById('loadPlanBtn');
const loadInput      = document.getElementById('loadPlanInput');
const exportCsvBtn   = document.getElementById('exportCsvBtn');
const printBtn       = document.getElementById('printBtn');
const activitySel    = document.getElementById('activityType');
const showAdvChk     = document.getElementById('showAdvanced');
const languageSelect = document.getElementById('languageSelector');
const updateSettingsBtn = document.getElementById('updateSettingsBtn');
const gpxFileInput   = document.getElementById('gpxFile');
const importRoadbooksChk = document.getElementById('importRoadbooks');

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
    await processGpxText(gpxText, { importRoadbooks, preserveRoadbooks: false });
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
  fileInput: gpxFileInput,
  selectBtn: document.getElementById('selectGpxBtn'),
  statusEl: document.getElementById('gpxStatus'),
  clearBtn: document.getElementById('clearRoadbooksBtn'),
  onBeforeFileAccept: () => confirmReplaceGpx(),
  onFileAccepted: (file) => autoProcessGpx(file)
});

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

if (activitySel) {
  applyActivityPreset(activitySel.value);
  activitySel.addEventListener('change', () => {
    applyActivityPreset(activitySel.value);
    updateSummaryCard();
  });
}

//
// ---------- Processing helpers ----------
function confirmReplaceGpx() {
  if (!trackLatLngs.length) return true;
  return window.confirm(t('gpx.replaceConfirm'));
}

async function autoProcessGpx(file) {
  if (!file) return;
  try {
    lastGpxName = file.name.replace(/\.[^/.]+$/, '');
    const gpxText = await readFileAsText(file);
    lastGpxText = String(gpxText || '');
    const importRoadbooks = importRoadbooksChk?.checked ?? true;
    await processGpxText(lastGpxText, { importRoadbooks, preserveRoadbooks: false });
  } catch (err) {
    console.error('Auto GPX processing failed:', err);
  }
}

if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    if (!trackLatLngs.length) return;
    const confirmed = window.confirm(t('map.confirmClearRoadbooks'));
    if (!confirmed) return;
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

if (updateSettingsBtn) {
  updateSettingsBtn.addEventListener('click', async () => {
    if (!lastGpxText) { alert(t('gpx.errors.noFile')); return; }
    updateSettingsBtn.disabled = true;
    try {
      await processGpxText(lastGpxText, { importRoadbooks: false, preserveRoadbooks: true });
    } finally {
      updateSettingsBtn.disabled = trackLatLngs.length === 0;
    }
  });
}

//
// ---------- Core processor (was a global; now lives here) ----------
async function processGpxText(gpxText, opts = {}) {
  const options = typeof opts === 'boolean' ? { importRoadbooks: opts } : (opts || {});
  const { importRoadbooks = true, preserveRoadbooks = false } = options;

  const preserved = (preserveRoadbooks && trackLatLngs.length)
    ? snapshotRoadbookState()
    : null;

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

  if (!preserved) {
    legLabels.clear();
    legStopsMin.clear();
    legCondPct.clear();
    legCritical.clear();
    legObservations.clear();
  }

  // rebuild roadbooks
  roadbookIdx.length = 0;
  roadbookLabels.clear();

  if (preserved) {
    restoreRoadbookState(preserved);
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
  if (updateSettingsBtn) {
    updateSettingsBtn.disabled = trackLatLngs.length === 0;
  }
  exportCsvBtn.disabled = false;
  saveBtn && (saveBtn.disabled = false);
  setTimeout(() => { printBtn && (printBtn.disabled = false); }, 0);
}

function snapshotRoadbookState() {
  const markerMap = new Map(getMarkers().map(m => [m.__idx, m]));
  return {
    trackLength: trackLatLngs.length,
    points: roadbookIdx.map(idx => ({
      idx,
      latlng: trackLatLngs[idx],
      label: roadbookLabels.get(idx) || '',
      locked: markerMap.get(idx)?.__locked ?? (idx === 0 || idx === trackLatLngs.length - 1)
    })),
    legLabels: new Map(legLabels),
    legStopsMin: new Map(legStopsMin),
    legCondPct: new Map(legCondPct),
    legCritical: new Map(legCritical),
    legObservations: new Map(legObservations)
  };
}

function restoreRoadbookState(snapshot) {
  const mapping = new Map();
  const seen = new Set();
  const newTrack = trackLatLngs;
  const oldTrackLength = snapshot.trackLength;

  snapshot.points.forEach((pt) => {
    let targetIdx;
    if (pt.locked && pt.idx === 0) targetIdx = 0;
    else if (pt.locked && pt.idx === oldTrackLength - 1) targetIdx = newTrack.length - 1;
    else targetIdx = nearestIndexOnTrack(pt.latlng, newTrack);

    mapping.set(pt.idx, targetIdx);
    if (seen.has(targetIdx)) return;
    seen.add(targetIdx);

    const locked = pt.locked && (targetIdx === 0 || targetIdx === newTrack.length - 1);
    const label = pt.label || (targetIdx === 0 ? t('map.start') : targetIdx === newTrack.length - 1 ? t('map.finish') : '');
    addRoadbookIndex(targetIdx, { noRender: true, label, locked });
  });

  if (!roadbookIdx.includes(0)) addRoadbookIndex(0, { noRender: true, label: t('map.start'), locked: true });
  if (!roadbookIdx.includes(newTrack.length - 1)) addRoadbookIndex(newTrack.length - 1, { noRender: true, label: t('map.finish'), locked: true });

  const remapMap = (source, target) => {
    target.clear();
    for (const [key, val] of source.entries()) {
      const [aStr, bStr] = key.split('|');
      const aOld = Number(aStr);
      const bOld = Number(bStr);
      if (!Number.isFinite(aOld) || !Number.isFinite(bOld)) continue;
      const aNew = mapping.get(aOld);
      const bNew = mapping.get(bOld);
      if (aNew == null || bNew == null || aNew === bNew) continue;
      target.set(`${aNew}|${bNew}`, val);
    }
  };

  remapMap(snapshot.legLabels, legLabels);
  remapMap(snapshot.legStopsMin, legStopsMin);
  remapMap(snapshot.legCondPct, legCondPct);
  remapMap(snapshot.legCritical, legCritical);
  remapMap(snapshot.legObservations, legObservations);
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
