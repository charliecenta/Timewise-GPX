// js/io.js
// Centralised I/O: read files, Save JSON, Load JSON, Export CSV, and UI wiring.
// This module is UI-agnostic and talks to the app via bindIoAPI().

import { t } from './i18n.js';

const API = {
  // DOM
  saveBtn: null,
  loadBtn: null,
  loadInput: null,
  exportCsvBtn: null,

  // App state getters (arrays)
  getTrackLatLngs: () => [],
  getCumDist: () => [],
  getCumAsc: () => [],
  getCumDes: () => [],
  getCumTime: () => [],

  // State refs (mutated when restoring)
  roadbookIdx: null,            // Array
  roadbookLabels: null,         // Map
  legLabels: null,              // Map
  legStopsMin: null,            // Map
  legCondPct: null,             // Map
  legCritical: null,            // Map
  legObservations: null,        // Map

  // Last GPX raw + name (for resumable saves)
  getLastGpxText: () => "",
  setLastGpxText: (t) => {},
  getLastGpxName: () => "",
  setLastGpxName: (n) => {},

  // App functions provided by host (script.js)
  processGpxText: async (_text, _importRoadbooks) => {},
  addRoadbookIndex: (_idx, _opts) => {},
  clearMarkers: () => {},
  renderRoadbooksTable: () => {},
  updateSummaryCard: () => {},
  showMainSections: (_show) => {},
  exportRoadbooksCsv: () => "",

  // Helpers
  nearestIndexOnTrack: (_latlng, _track) => 0, // not used here but left for symmetry
};

export function bindIoAPI(bindings) {
  Object.assign(API, bindings);
}

/* ----------------- Public helpers ----------------- */

/** Read any File as text. */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload  = () => resolve(reader.result);
    reader.readAsText(file);
  });
}

/** Attach Save / Load / Export click handlers once. */
export function wireSaveLoadExport() {
  const { saveBtn, loadBtn, loadInput, exportCsvBtn } = API;
  if (saveBtn) {
    saveBtn.addEventListener('click', onSaveClick);
  }
  if (loadBtn && loadInput) {
    loadBtn.addEventListener('click', () => loadInput.click());
    loadInput.addEventListener('change', onLoadChange);
  }
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', onExportCsv);
  }
}

/** Create a serialisable snapshot of current plan (incl. embedded GPX). */
export function serializePlan() {
  const track = API.getTrackLatLngs();
  if (!track.length) return null;

  // Build legs from current roadbooks
  const legs = [];
  const idxs = API.roadbookIdx;
  const cumD = API.getCumDist();
  const cumU = API.getCumAsc();
  const cumV = API.getCumDes();
  const cumT = API.getCumTime();

  let cumDistKmShown = 0, cumAscMShown = 0, cumDesMShown = 0, cumTimeAdjH = 0;
  const lastIdx = track.length - 1;

  for (let k = 1; k < idxs.length; k++) {
    const aRaw = idxs[k - 1];
    const bRaw = idxs[k];
    const a = Math.max(0, Math.min(aRaw, lastIdx));
    const b = Math.max(0, Math.min(bRaw, lastIdx));
    const key = `${a}|${b}`;

    const dA = cumD[a] ?? 0, dB = cumD[b] ?? dA;
    const uA = cumU[a] ?? 0, uB = cumU[b] ?? uA;
    const vA = cumV[a] ?? 0, vB = cumV[b] ?? vA;
    const tA = cumT[a] ?? 0, tB = cumT[b] ?? tA;

    const distKm = dB - dA;
    const ascM   = uB - uA;
    const desM   = vB - vA;
    const baseH  = tB - tA;

    const stopsMin = API.legStopsMin.get(key) ?? 0;
    const condPct  = API.legCondPct.get(key)  ?? 0;
    const name     = API.legLabels.get(key)   || defaultLegLabel(a, b);
    const obs      = API.legObservations.get(key) ?? "";

    const totalH   = baseH * (1 + condPct / 100) + (stopsMin / 60);

    cumDistKmShown += distKm;
    cumAscMShown   += ascM;
    cumDesMShown   += desM;
    cumTimeAdjH    += totalH;

    legs.push({
      idx: k, a, b, key, name,
      distKm, ascM, desM, baseH, stopsMin, condPct, totalH,
      cumDistKm: cumDistKmShown, cumAscM: cumAscMShown, cumDesM: cumDesMShown, cumTimeAdjH,
      critical: !!(API.legCritical.get(key)),
      observations: obs
    });
  }

  const settings = {
    speedFlatKmh: floatValById("speedFlat", 4),
    speedVertMh:  floatValById("speedVert", 300),
    downhillFactor: floatValById("downhillFactor", 0.6667),
    spacingM: floatValById("spacingM", 5),
    smoothWinM: floatValById("smoothWinM", 35),
    elevDeadbandM: floatValById("elevDeadbandM", 2),
    activity: (document.getElementById("activityType")?.value || "hike")
  };

  return {
    version: 2,
    createdAt: new Date().toISOString(),
    gpxText: API.getLastGpxText() || null,       // embed GPX
    signature: trackSignature(),
    settings,
    meta: { gpxName: API.getLastGpxName() || null },
    roadbookIdx: idxs.slice(),
    roadbookLabels: Object.fromEntries(API.roadbookLabels),
    legLabels: Object.fromEntries(API.legLabels),
    legStopsMin: Object.fromEntries(API.legStopsMin),
    legCondPct: Object.fromEntries(API.legCondPct),
    legCritical: Object.fromEntries(API.legCritical),
    legObservations: Object.fromEntries(API.legObservations),
    legs
  };
}

/** Restore a plan (rebuild track if needed from embedded GPX; then rebuild waypoints & legs). */
export async function restorePlanFromJSON(plan) {
  const track = API.getTrackLatLngs();

  if (!track.length) {
    if (!plan.gpxText) {
      alert(t('io.savedPlanMissing'));
      return;
    }
    // Apply saved settings to DOM BEFORE processing GPX
    const s = plan.settings || {};
    setIf("activityType",   s.activity);
    setIf("speedFlat",      s.speedFlatKmh);
    setIf("speedVert",      s.speedVertMh);
    setIf("downhillFactor", s.downhillFactor);
    setIf("spacingM",       s.spacingM);
    setIf("smoothWinM",     s.smoothWinM);
    setIf("elevDeadbandM",  s.elevDeadbandM);

    // Rebuild track (do NOT import GPX waypoints—plan will add them)
    await API.processGpxText(plan.gpxText, /* importRoadbooks */ false);

    // Also store GPX in the app state for subsequent saves
    API.setLastGpxText(plan.gpxText || "");
  }

  // Optional sanity check (just warn in console)
  try {
    const sig = trackSignature();
    if (plan.signature && sig && sig.n !== plan.signature.n) {
      console.warn("Saved plan may belong to a different GPX/settings. Legs may not align perfectly.");
    }
  } catch {}

  // Keep the saved GPX name for nicer save filenames
  if (plan.meta && plan.meta.gpxName) {
    API.setLastGpxName(plan.meta.gpxName);
  }

  // Snapshot saved roadbooks/labels and per-leg maps
  const savedIdxArr = Array.isArray(plan.roadbookIdx) ? plan.roadbookIdx.slice() : [];
  const savedLabels = new Map(Object.entries(plan.roadbookLabels || {}).map(([k,v]) => [Number(k), v]));
  API.legLabels       = new Map(Object.entries(plan.legLabels      || {}));
  API.legStopsMin     = new Map(Object.entries(plan.legStopsMin    || {}));
  API.legCondPct      = new Map(Object.entries(plan.legCondPct     || {}));
  API.legCritical     = new Map(Object.entries(plan.legCritical    || {}).map(([k,v]) => [k, !!v]));
  API.legObservations = new Map(Object.entries(plan.legObservations|| {}));

  // Reset current map waypoints
  API.clearMarkers();
  API.roadbookIdx.length = 0;
  API.roadbookLabels.clear();

  // Rebuild markers + labels exactly as saved
  const tl = API.getTrackLatLngs();
  for (const i of savedIdxArr) {
    const locked = (i === 0 || i === tl.length - 1);
    API.addRoadbookIndex(i, { noRender: true, label: savedLabels.get(i), locked });
  }

  API.renderRoadbooksTable();
  API.updateSummaryCard();
  API.showMainSections(true);

  if (API.saveBtn)   API.saveBtn.disabled   = false;
  if (API.exportCsvBtn) API.exportCsvBtn.disabled = false;
}

/* ----------------- internal: event handlers ----------------- */

async function onSaveClick() {
  const plan = serializePlan();
  if (!plan) return;

  const baseFromName = (API.getLastGpxName() || "route").replace(/[^\w\-]+/g, '_');
  const baseFromStart = (API.roadbookLabels.get(0) || "route").replace(/[^\w\-]+/g, '_');
  const base = baseFromName || baseFromStart || "route";

  downloadFile(`${base}-timewisegpx.json`, 'application/json', JSON.stringify(plan, null, 2));
}

async function onLoadChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const trimmed = String(text).trim();

    // If user selects a GPX file here by mistake, import it as GPX
    if (/^</.test(trimmed)) {
      await API.processGpxText(trimmed, /* importRoadbooks */ true);
      alert(t('io.loadedGpx'));
      return;
    }

    // Otherwise parse plan JSON (strip BOM)
    let plan;
    try {
      plan = safeParseJSON(text);
    } catch (parseErr) {
      console.error('JSON parse failed:', parseErr);
      alert(t('io.parseFailed'));
      return;
    }

    if (!plan.gpxText && API.getTrackLatLngs().length === 0) {
      alert(t('io.missingEmbeddedGpx'));
      return;
    }

    await restorePlanFromJSON(plan);
  } catch (err) {
    console.error('Load failed:', err);
    alert(t('io.loadFailed', { message: err?.message ?? '' }));
  } finally {
    if (API.loadInput) API.loadInput.value = "";
  }
}

function onExportCsv() {
  const csv = API.exportRoadbooksCsv?.();
  if (!csv) { alert(t('io.noTable')); return; }
  downloadFile('roadbooks_table.csv', 'text/csv;charset=utf-8', csv);
}

/* ----------------- internal: small utils ----------------- */

function floatValById(id, d) {
  const v = parseFloat(document.getElementById(id)?.value);
  return Number.isFinite(v) ? v : d;
}

function setIf(id, v) {
  if (v == null) return;
  const el = document.getElementById(id);
  if (el) el.value = v;
}

function defaultLegLabel(a, b) {
  const name = (idx) => {
    if (API.roadbookLabels.has(idx)) return API.roadbookLabels.get(idx);
    const pos = API.roadbookIdx.indexOf(idx);
    return pos >= 0 ? `WP ${pos + 1}` : `WP ${idx}`;
  };
  return `${name(a)} \u2192 ${name(b)}`;
}

function safeParseJSON(text) {
  const clean = String(text || '').replace(/^\uFEFF/, ''); // strip BOM
  return JSON.parse(clean);
}

function trackSignature() {
  const tl = API.getTrackLatLngs();
  if (!tl.length) return null;
  const n = tl.length;
  const first = tl[0], last = tl[n - 1];
  return {
    n, first, last,
    spacingM: floatValById("spacingM", 5),
    smoothWinM: floatValById("smoothWinM", 35),
    elevDeadbandM: floatValById("elevDeadbandM", 2),
  };
}

function downloadFile(filename, mime, text) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
