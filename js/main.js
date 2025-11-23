// js/main.js — app bootstrap & wiring (single source of truth)

import { setupThemeToggle, setupAdvancedToggle, setupGpxDropzone, showMainSections } from './ui.js';
import { bindIoAPI, readFileAsText, wireSaveLoadExport, restorePlanFromJSON } from './io.js';
import { bindTableAPI, renderRoadbooksTable, updateSummaryCard, wireTableFades, exportRoadbooksCsv } from './table.js';
import { bindMapAPI, ensureMap, drawPolyline, clearMarkers, addRoadbookIndex, refreshTiles, invalidateMapSize, refitToTrack, ensureLabelPopup, getMarkers, clearPolyline } from './map.js';
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
const elevationProfileEl = document.getElementById('elevationProfile');
const quickUploadBtn = document.getElementById('quickUploadBtn');
const routeModeButtons = document.querySelectorAll('[data-route-mode]');
const undoPointBtn = document.getElementById('undoPointBtn');
const startFreshBtn = document.getElementById('startFreshBtn');
const tabButtons = document.querySelectorAll('[data-panel-target]');
const tabPanels = document.querySelectorAll('.info-panel');
const drawer = document.getElementById('infoDrawer');

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

function readSettingsFromDom() {
  return {
    spacingM:      toPosNum(document.getElementById('spacingM')?.value, 5),
    smoothWinM:    toPosNum(document.getElementById('smoothWinM')?.value, 15),
    elevDeadbandM: toNonNegNum(document.getElementById('elevDeadbandM')?.value, 2),
    speedFlatKmh:  toPosNum(document.getElementById('speedFlat')?.value, 4),
    speedVertMh:   toPosNum(document.getElementById('speedVert')?.value, 300),
    downhillFactor: toPosNum(document.getElementById('downhillFactor')?.value, 0.6667),
    activity: activitySel?.value || 'hike'
  };
}

//
// ---------- App state (single source of truth) ----------
let trackLatLngs   = [];  // [[lat, lon], ...] resampled
let trackElevationM = [];
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
let lastSource = 'gpx';
let manualSegments = [];
let draftPoints = [];
let routeMode = 'manual';

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
  confirmDelete: (msg) => window.confirm(msg),
  onMapClick: (e) => handleMapClickForRouting(e)
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
  lastSource = 'gpx';
  manualSegments = [];
  draftPoints = [];
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
  if (lastSource === 'manual' && manualSegments.length) {
    rebuildManualRoute();
    return;
  }
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

quickUploadBtn?.addEventListener('click', () => {
  document.getElementById('selectGpxBtn')?.click();
});

document.getElementById('selectGpxBtnMirror')?.addEventListener('click', () => {
  document.getElementById('selectGpxBtn')?.click();
});

routeModeButtons.forEach(btn => {
  btn.addEventListener('click', () => setRouteMode(btn.dataset.routeMode));
});

undoPointBtn?.addEventListener('click', () => {
  draftPoints.pop();
  if (draftPoints.length >= 2) {
    manualSegments = [draftPoints.map(p => ({ ...p }))];
    rebuildManualRoute();
  } else {
    startFreshManualRoute();
  }
});

startFreshBtn?.addEventListener('click', () => {
  setRouteMode('manual');
  startFreshManualRoute();
});

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.panelTarget;
    tabPanels.forEach(panel => panel.classList.toggle('active', panel.id === target));
    tabButtons.forEach(b => b.classList.toggle('active', b === btn));
    drawer?.classList.add('open');
    invalidateMapSize();
  });
});

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

function setRouteMode(mode) {
  routeMode = mode;
  routeModeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.routeMode === mode);
  });
}

function startFreshManualRoute() {
  draftPoints = [];
  manualSegments = [];
  lastSource = 'manual';
  lastGpxText = '';
  lastGpxName = '';
  trackLatLngs = [];
  trackElevationM = [];
  trackBreakIdx = [];
  cumDistKm = [0];
  cumAscentM = [0];
  cumDescentM = [0];
  cumTimeH = [0];
  clearPolyline();
  clearMarkers();
  resetRoadbooks();
  renderRoadbooksTable();
  updateSummaryCard();
  renderElevationProfile();
  showMainSections(false);
}

function rebuildManualRoute() {
  if (!manualSegments.length) {
    showMainSections(false);
    renderElevationProfile();
    return;
  }
  const built = buildTrackFromSegments(manualSegments, readSettingsFromDom());
  applyBuiltTrack(built);
  lastSource = 'manual';
}

function handleMapClickForRouting(e) {
  if (routeMode !== 'manual' && routeMode !== 'autoroute') return false;
  draftPoints.push({ lat: e.latlng.lat, lon: e.latlng.lng, ele: null });
  if (draftPoints.length >= 2) {
    manualSegments = [draftPoints.map(p => ({ ...p }))];
    rebuildManualRoute();
  }
  return true;
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

function resetRoadbooks() {
  roadbookIdx.length = 0;
  roadbookLabels.clear();
  legLabels.clear();
  legStopsMin.clear();
  legCondPct.clear();
  legCritical.clear();
  legObservations.clear();
}

function renderElevationProfile() {
  if (!elevationProfileEl) return;
  if (!trackLatLngs.length || !trackElevationM.length) {
    elevationProfileEl.innerHTML = `<p class="empty-profile">${t('gpx.dropHint')}</p>`;
    return;
  }

  const totalDist = cumDistKm[cumDistKm.length - 1] ?? 0;
  const distanceLabel = t('map.distance') || 'Distance';
  const elevLabel = t('map.elevation') || 'Elevation';
  const width = 720;
  const height = 180;
  const points = trackElevationM.map((ele, idx) => ({
    x: (totalDist ? (cumDistKm[idx] / totalDist) : 0) * width,
    y: ele ?? 0
  }));

  const allElev = points.map(p => p.y);
  const minEle = Math.min(...allElev);
  const maxEle = Math.max(...allElev);
  const span = Math.max(1, maxEle - minEle);

  const areaPath = ['M 0', height, 'L'];
  points.forEach((p, i) => {
    const y = height - ((p.y - minEle) / span) * height;
    const x = Math.min(width, Math.max(0, p.x));
    areaPath.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    if (i < points.length - 1) areaPath.push('L');
  });
  areaPath.push('L', width, height, 'Z');

  const profile = `
    <svg class="elevation-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Elevation profile">
      <path d="${areaPath.join(' ')}" fill="url(#grad)" stroke="var(--accent)" stroke-width="2" />
      <defs>
        <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.35"></stop>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.05"></stop>
        </linearGradient>
      </defs>
    </svg>
    <div class="profile-meta">
      <div><strong>${t('map.summary')}</strong></div>
      <div>${distanceLabel}: ${cumDistKm[cumDistKm.length - 1].toFixed(2)} km</div>
      <div>${elevLabel}: ${Math.round(minEle)} m → ${Math.round(maxEle)} m</div>
    </div>`;

  elevationProfileEl.innerHTML = profile;
}

function applyBuiltTrack(built, { importRoadbooks = false, preservedRoadbooks = null, gpxText = null } = {}) {
  trackLatLngs = built.trackLatLngs || [];
  trackElevationM = built.trackElevationM || [];
  trackBreakIdx = built.breakIdx || [];
  cumDistKm   = built.cumDistKm || [0];
  cumAscentM  = built.cumAscentM || [0];
  cumDescentM = built.cumDescentM || [0];
  cumTimeH    = built.cumTimeH || [0];

  ensureMap();
  if (trackLatLngs.length > 1) {
    drawPolyline(trackLatLngs);
  } else {
    clearPolyline();
  }

  clearMarkers();
  resetRoadbooks();

  const preserved = preservedRoadbooks || null;

  if (preserved) {
    restoreRoadbooks(preserved);
  } else if (importRoadbooks && gpxText) {
    const wpts = parseGPXRoadbooks(gpxText);
    const seen = new Set();
    for (const w of wpts) {
      const idx = nearestIndexOnTrack([w.lat, w.lon], trackLatLngs);
      if (seen.has(idx)) continue;
      seen.add(idx);
      addRoadbookIndex(idx, { noRender: true, label: w.name || '' });
    }
  }

  if (trackLatLngs.length) {
    addRoadbookIndex(0, { noRender: true, label: t('map.start'), locked: true });
    addRoadbookIndex(trackLatLngs.length - 1, { noRender: true, label: t('map.finish'), locked: true });
  }

  renderRoadbooksTable();
  updateSummaryCard();
  renderElevationProfile();

  const hasTrack = trackLatLngs.length > 1;
  showMainSections(hasTrack);

  if (clearBtn) clearBtn.disabled = !hasTrack;
  if (exportCsvBtn) exportCsvBtn.disabled = !hasTrack;
  if (saveBtn) saveBtn.disabled = !hasTrack;
  setTimeout(() => { if (printBtn) printBtn.disabled = !hasTrack; }, 0);

  setTimeout(() => {
    invalidateMapSize();
    refreshTiles();
    if (hasTrack) refitToTrack([24, 24]);
  }, 0);
}

//
// ---------- Core processor (was a global; now lives here) ----------
async function processGpxText(gpxText, importRoadbooks = true, options = {}) {
  const { preserveRoadbooks = false } = options;
  const preserved = preserveRoadbooks ? snapshotRoadbooks() : null;
  const segments = parseGPXToSegments(gpxText);
  if (!segments.length) { alert(t('gpx.errors.noSegments')); return; }

  // build track + cumulatives
  const built = buildTrackFromSegments(segments, readSettingsFromDom());
  applyBuiltTrack(built, { importRoadbooks, preservedRoadbooks: preserved, gpxText });

  window.addEventListener('resize', () => {
    invalidateMapSize();
    refitToTrack([24, 24]);
  }, { passive: true });
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

setRouteMode(routeMode);
ensureMap();
renderElevationProfile();
if (tabButtons.length) {
  tabButtons[0].classList.add('active');
  const target = tabButtons[0].dataset.panelTarget;
  tabPanels.forEach(panel => panel.classList.toggle('active', panel.id === target));
}
