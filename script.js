// Route Time Estimator — Clean V2 (Print=Table only; no map image in PDF)
// - Live Leaflet map for planning (not printed)
// - GPX processing: resample, smooth, deadband filter, per-step time model
// - Waypoints/roadbooks import + on-map add/remove
// - Roadbooks table: grouped headers, editable Name/Stops/Conditions
// - Save/Load JSON, Export CSV (DOM), Simple Print (window.print)

// ---------- DOM ----------
const outputEl = document.getElementById("output");
const roadbooksEl = document.getElementById("roadbooks");

const calcBtn  = document.getElementById("calculateBtn");
const clearBtn = document.getElementById("clearRoadbooksBtn");
const saveBtn   = document.getElementById("savePlanBtn");
const loadBtn   = document.getElementById("loadPlanBtn");
const loadInput = document.getElementById("loadPlanInput");
const exportCsv = document.getElementById("exportCsvBtn");
const printBtn  = document.getElementById("printBtn");


// === Activity & Advanced Configuration (single source of truth) ===
const activitySel = document.getElementById("activityType");
const showAdvChk  = document.getElementById("showAdvanced");

// Presets: spacing (m), smoothing window (m), flat speed (km/h), vertical speed (m/h), downhill factor
const ACTIVITY_PRESETS = {
  road:   { spacing: 5, smooth: 40, speedFlat: 24, speedVert: 900, dhf: 0.40 },   // Road cycling
  mtb:    { spacing: 4, smooth: 20, speedFlat: 14, speedVert: 700, dhf: 0.60 },   // Mountain biking
  hike:   { spacing: 3, smooth: 15, speedFlat:  4, speedVert: 300, dhf: 0.6667 }, // Hiking / trail
};

// Allowed range for condition percentage
const MIN_COND_PCT = -90;
const MAX_COND_PCT = 300;

// Marker icon
const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconSize: [25, 41],
  iconAnchor: [12.5, 41], // anchor = bottom center of icon
  tooltipAnchor: [0, -28] // vertical offset to position tooltip above marker
});


function applyActivityPreset(kind) {
  const p = ACTIVITY_PRESETS[kind];
  if (!p) return;

  // Advanced fields
  const spacingInput = document.getElementById("spacingM");
  const smoothInput  = document.getElementById("smoothWinM");
  if (spacingInput) spacingInput.value = p.spacing;
  if (smoothInput)  smoothInput.value  = p.smooth;

  // Pace model fields
  const flat = document.getElementById("speedFlat");
  const vert = document.getElementById("speedVert");
  const dhf  = document.getElementById("downhillFactor");
  if (flat) flat.value = p.speedFlat;
  if (vert) vert.value = p.speedVert;
  if (dhf)  dhf.value  = p.dhf;
}

// ---------- Global state ----------
let map, tileLayer, polyline, markers = [];
let trackLatLngs = [];        // [[lat, lon], ...] (resampled)
let trackBreakIdx = [];       // segment starts
let cumDistKm = [];           // prefix sums
let cumAscentM = [];
let cumDescentM = [];
let cumTimeH = [];

let roadbookIdx = [];         // indices into trackLatLngs
let roadbookLabels = new Map(); // pointIndex -> label
let legLabels = new Map();      // "a|b" -> custom leg name

// Per-leg overrides
let legStopsMin = new Map();   // "a|b" -> minutes
let legCondPct  = new Map();   // "a|b" -> percent
let legCritical = new Map();   // "a|b" -> true (Yes) / false (No)

// Free-form comments per leg (key = "a|b")
let legObservations = new Map();

// Holds the sum of leg times including Stops + Conditions
let lastTotalAdjustedH = 0;

// Keep the raw GPX text so saves can be reloaded without re-uploading a file
let lastGpxText = "";
let lastGpxName = ""; 

// Helper to toggle visibility of main sections
function showMainSections(show) {
  const ids = ['mapCard', 'summaryCard', 'roadbooksCard'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('is-hidden', !show);
  });
}
showMainSections(false);

// Build the mini toolbar HTML for a marker
function waypointToolbarHtml() {
  return `
    <div class="wb-toolbar">
      <button type="button" class="wb-btn wb-edit"><span class="ico">✏️</span>Edit</button>
      <button type="button" class="wb-btn wb-del"><span class="ico">🗑️</span>Delete</button>
    </div>
  `;
}

// Delete waypoint
function deleteWaypoint(m, confirmed = false) {
  if (m.__locked) return;

  // Only confirm here if the caller hasn't already done it
  if (!confirmed) {
    if (!confirm('Are you sure you want to remove this waypoint?')) return;
  }

  // remove index from ordered list
  const pos = roadbookIdx.indexOf(m.__idx);
  if (pos >= 0) roadbookIdx.splice(pos, 1);

  // find the marker in our array
  const mi = markers.findIndex(mm => mm.__idx === m.__idx);

  // remove the label popup first (so we target the correct marker)
  removeLabelPopup(m);

  // then remove the marker and splice
  if (mi >= 0) { markers[mi].remove(); markers.splice(mi, 1); }

  // clear per-leg data involving this waypoint
  const mapsToClean = [legLabels, legStopsMin, legCondPct, legCritical, legObservations];
  mapsToClean.forEach(mapObj => {
    for (const k of [...mapObj.keys()]) {
      const [a, b] = String(k).split('|').map(Number);
      if (a === m.__idx || b === m.__idx) mapObj.delete(k);
    }
  });

  renderRoadbooksTable();
}

// ---------- Map init (live only) ----------
function ensureMap() {
  if (map) return;
  map = L.map('map');

  // 🗺️ OpenTopoMap tiles (shows contour lines and terrain)
  tileLayer = L.tileLayer(
    'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 17,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
        '<a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
    }
  ).addTo(map);

  map.on('click', (e) => {
    if (!trackLatLngs.length) return;
    const i = nearestIndexOnTrack([e.latlng.lat, e.latlng.lng], trackLatLngs);
    addRoadbookIndex(i, { editOnCreate: true });   // ✅ open editor immediately
  }); 
}
ensureMap();

// ---------- GPX Drag & Drop Upload ----------
(function setupGpxDropzone(){
  const drop = document.getElementById('gpxDrop');
  const fileInput = document.getElementById('gpxFile');
  const selectBtn = document.getElementById('selectGpxBtn');
  const statusEl = document.getElementById('gpxStatus');
  const processBtn = document.getElementById('processBtn'); // <-- make sure your Process button has this id

  if (!drop || !fileInput) return;

  const on = (el, evts, fn) => evts.forEach(evt => el.addEventListener(evt, fn));

  const highlight = (e) => { e.preventDefault(); e.stopPropagation(); drop.classList.add('dragover'); };
  const unhighlight = (e) => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('dragover'); };

  on(drop, ['dragenter','dragover'], highlight);
  on(drop, ['dragleave','drop'],    unhighlight);



  // --- NEW: status updaters
  const kib = (n) => (n/1024).toFixed(1) + ' KB';
  const setReady = (file) => {
    drop.classList.remove('error');
    drop.classList.add('uploaded');
    if (statusEl) statusEl.innerHTML = `<span class="ok">Ready:</span> ${file.name} · ${kib(file.size)}`;
    if (selectBtn) selectBtn.textContent = 'Change File';
    if (processBtn) processBtn.disabled = false;  // enable processing
  };
  const setError = (msg) => {
    drop.classList.remove('uploaded');
    drop.classList.add('error');
    if (statusEl) statusEl.innerHTML = `<span class="err">Error:</span> ${msg}`;
    if (processBtn) processBtn.disabled = true;
  };
  const clearState = () => {
    drop.classList.remove('uploaded','error');
    if (statusEl) statusEl.textContent = '';
    if (selectBtn) selectBtn.textContent = 'Select File';
    // optionally disable process until file chosen again:
    // if (processBtn) processBtn.disabled = true;
  };

  // Handle a dropped file -> feed into input + update UI
  drop.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer?.files || []);
    const gpx = files.find(f => /\.gpx$/i.test(f.name) || f.type === 'application/gpx+xml');
    if (!gpx) { setError('Please drop a .gpx file'); return; }
    const dt = new DataTransfer();
    dt.items.add(gpx);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Button / box click opens chooser
  selectBtn?.addEventListener('click', () => fileInput.click());
  drop.addEventListener('click', (e) => {
    if (!(e.target instanceof HTMLButtonElement)) fileInput.click();
  });
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });

  // --- Whenever input changes, reflect UI state
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (!f) { clearState(); return; }
    if (!/\.gpx$/i.test(f.name) && f.type !== 'application/gpx+xml') {
      setError('Selected file is not a .gpx');
      return;
    }
    setReady(f);
  });

  // Clear roadbooks UI reset
  document.getElementById('clearRoadbooksBtn')?.addEventListener('click', clearState);
})();


// Advanced toggle: show/hide advanced fields
if (showAdvChk) {
  showAdvChk.addEventListener('change', () => {
    const card = document.getElementById('settingsCard');
    card?.classList.toggle('show-adv', showAdvChk.checked);
  });
  // default hidden (unchecked)
  showAdvChk.checked = false;
  document.getElementById('settingsCard')?.classList.remove('show-adv');
}

// Apply activity preset on change
if (activitySel) {
  activitySel.addEventListener('change', () => applyActivityPreset(activitySel.value));
  // Initial preset on load
  applyActivityPreset(activitySel.value || 'hike');
}

// Process a GPX text string using current DOM settings.
// When importRoadbooks=false, we do not import GPX waypoints (the plan will restore them).
async function processGpxText(gpxText, importRoadbooks = true) {
  lastGpxText = gpxText; // keep raw GPX for Save/Load

  const importWpts = importRoadbooks;

  const speedFlatKmh   = toPosNum(document.getElementById("speedFlat")?.value, 4);
  const speedVertMh    = toPosNum(document.getElementById("speedVert")?.value, 300);
  const downhillFactor = toPosNum(document.getElementById("downhillFactor")?.value, 0.6667);
  const spacingM       = clamp(toPosNum(document.getElementById("spacingM")?.value, 5), 1, 100);
  const smoothWinM     = clamp(toPosNum(document.getElementById("smoothWinM")?.value, 35), 5, 500);
  const elevDeadbandM  = clamp(toNonNegNum(document.getElementById("elevDeadbandM")?.value, 2), 0, 20);

  if (!(speedFlatKmh > 0) || !(speedVertMh > 0) || !(downhillFactor > 0)) {
    alert("Please provide valid positive numbers for speeds and downhill factor.");
    return;
  }

  const segments = parseGPXToSegments(gpxText);
  if (!segments.length) {
    outputEl.innerHTML = "<p>No track segments found.</p>";
    return;
  }

  // reset globals
  trackLatLngs = [];
  trackBreakIdx = [];
  cumDistKm = [0];
  cumAscentM = [0];
  cumDescentM = [0];
  cumTimeH = [0];
  roadbookIdx = [];
  roadbookLabels.clear();
  legLabels.clear();
  legStopsMin.clear();
  legCondPct.clear();
  legCritical.clear();
  clearMarkers();

  let totalDistKm = 0, totalAscentM = 0, totalDescentM = 0, totalTimeHrs = 0;
  const debugRows = [];
  let globalIdxOffset = 0;

  for (const pts of segments) {
    if (pts.length < 2) continue;

    const filled = fillElevationOnPoints(pts);
    const resampled = resampleByDistance(filled, spacingM);
    if (resampled.length < 2) continue;

    const winSamples = clampToOdd(Math.max(3, Math.round(smoothWinM / spacingM)), 3, 999);
    const elev = resampled.map(p => p.ele);
    const elevSmooth = medianFilter(elev, winSamples);
    const elevFiltered = cumulativeDeadbandFilter(elevSmooth, elevDeadbandM);

    // segment break
    trackBreakIdx.push(trackLatLngs.length);

    // keep cum arrays aligned (+1 at boundaries)
    if (trackLatLngs.length > 0) {
      cumDistKm.push(cumDistKm[cumDistKm.length - 1]);
      cumAscentM.push(cumAscentM[cumAscentM.length - 1]);
      cumDescentM.push(cumDescentM[cumDescentM.length - 1]);
      cumTimeH.push(cumTimeH[cumTimeH.length - 1]);
    }

    const latlngs = resampled.map(p => [p.lat, p.lon]);
    trackLatLngs = trackLatLngs.concat(latlngs);

    for (let i = 1; i < resampled.length; i++) {
      const p1 = resampled[i - 1];
      const p2 = resampled[i];
      const distKm = haversineKm(p1.lat, p1.lon, p2.lat, p2.lon);

      const dEleF = (elevFiltered[i] ?? elevFiltered[i - 1]) - (elevFiltered[i - 1] ?? elevFiltered[i]);
      const ascentM  = dEleF > 0 ? dEleF : 0;
      const descentM = dEleF < 0 ? -dEleF : 0;

      const h = distKm / speedFlatKmh; // hours
      const vMag = ascentM > 0 ? ascentM : descentM;
      const v = vMag > 0 ? (vMag / speedVertMh) : 0;

      let segTimeH = Math.max(h, v) + 0.5 * Math.min(h, v);
      if (descentM > 0 && descentM >= ascentM) segTimeH *= downhillFactor;

      totalDistKm   += distKm;
      totalAscentM  += ascentM;
      totalDescentM += descentM;
      totalTimeHrs  += segTimeH;

      cumDistKm.push(cumDistKm[cumDistKm.length - 1] + distKm);
      cumAscentM.push(cumAscentM[cumAscentM.length - 1] + ascentM);
      cumDescentM.push(cumDescentM[cumDescentM.length - 1] + descentM);
      cumTimeH.push(cumTimeH[cumTimeH.length - 1] + segTimeH);
    }
    globalIdxOffset += resampled.length;
  }

  // draw/fit
  if (polyline) polyline.remove();
  polyline = L.polyline(trackLatLngs, { weight: 4, color: '#2a7de1' }).addTo(map);
  map.fitBounds(polyline.getBounds());
  clearBtn.disabled = false;

  // start/end waypoints
  if (trackLatLngs.length >= 2) {
    addRoadbookIndex(0, { noRender: true, label: "Start", locked: true });
    addRoadbookIndex(trackLatLngs.length - 1, { noRender: true, label: "Finish", locked: true });
  }

  // optionally import GPX waypoints (NOT used when restoring a plan)
  if (importWpts) {
    const waypoints = parseGPXRoadbooks(gpxText);
    for (const wp of waypoints) {
      const idx = nearestIndexOnTrack([wp.lat, wp.lon], trackLatLngs);
      if (!roadbookIdx.includes(idx)) addRoadbookIndex(idx, { noRender: true, label: wp.name || "WP" });
      else if (!roadbookLabels.get(idx) && wp.name) setRoadbookLabel(idx, wp.name);
    }
  }

  renderRoadbooksTable();
  updateSummaryCard();
  showMainSections(true);

  requestAnimationFrame(() => {
    try {
      map.invalidateSize(true);
      if (polyline) map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
    } catch {}
  });

  // enable actions
  saveBtn.disabled   = false;
  exportCsv.disabled = false;
  printBtn.disabled  = true;
  setTimeout(() => { printBtn.disabled = false; }, 0);
}

document.addEventListener('DOMContentLoaded', () => {
  wireTableFades();
});


// ---------- Main flow ----------
// ---------- Main flow ----------
calcBtn.addEventListener("click", async () => {
  const fileInput = document.getElementById("gpxFile");
  if (!fileInput?.files?.length) {
    alert("Please upload a GPX file.");
    return;
  }
  const file = fileInput.files[0];
  // ✅ store the base filename (no extension) for saving later
  lastGpxName = file.name.replace(/\.[^/.]+$/, "");

  const gpxText = await readFileAsText(file);
  const importRoadbooks = document.getElementById("importRoadbooks")?.checked ?? true;
  await processGpxText(String(gpxText || ""), importRoadbooks);
});





clearBtn.addEventListener('click', () => {
  if (!trackLatLngs.length) return;
  roadbookIdx = [];
  roadbookLabels.clear();
  legLabels.clear();
  legStopsMin.clear();
  legCondPct.clear();
  legCritical.clear();
  clearMarkers();
  addRoadbookIndex(0, { noRender: true, label: "Start", locked: true });
  addRoadbookIndex(trackLatLngs.length - 1, { noRender: true, label: "Finish", locked: true });
  renderRoadbooksTable();
});

// ---------- Print (table-only) ----------
if (printBtn) {
  printBtn.addEventListener('click', () => {
    // No popup windows, no snapshots. Just print the current page.
    // CSS hides map & controls in @media print.
    window.print();
  });
}

// ---------- Roadbooks (add/remove/labels) ----------
function addRoadbookIndex(i, opts = {}) {
  const { noRender = false, label = "", locked = false, editOnCreate = false } = opts;
  i = Math.max(0, Math.min(trackLatLngs.length - 1, Math.round(i)));

  // If this index already exists, optionally update its label and return.
  if (roadbookIdx.includes(i)) {
    const newLabel = (label || "").trim();
    if (newLabel && (!roadbookLabels.get(i) || roadbookLabels.get(i) === `#${i}`)) {
      setRoadbookLabel(i, newLabel);
    }
    if (!noRender) renderRoadbooksTable();
    return;
  }

  roadbookIdx.push(i);
  roadbookIdx.sort((a, b) => a - b);

  const initial = (label && String(label).trim()) ||
                  roadbookLabels.get(i) ||
                  (i === 0 ? "Start" :
                   i === trackLatLngs.length - 1 ? "Finish" :
                   `WP ${roadbookIdx.indexOf(i) + 1}`);

  roadbookLabels.set(i, initial);

  const m = L.marker(trackLatLngs[i], { icon: markerIcon }).addTo(map);
  m.__idx = i;
  m.__locked = locked;

  if (label) setWaypointName(i, label);

  // Always-open label popup above the pin
  ensureLabelPopup(m);

  // Remove any prior listeners
  m.off('click');
  m.off('dblclick');

  // Prevent marker clicks from opening the editor (label only should trigger it)
  m.on('click', (e) => {
    e.originalEvent?.stopPropagation();
    e.originalEvent?.preventDefault();
    return false;
  });
  m.on('dblclick', (e) => {
    e.originalEvent?.stopPropagation();
    e.originalEvent?.preventDefault();
    return false;
  });

  m.unbindPopup();

  // Keep label responsible for editing
  ensureLabelPopup(m);
  markers.push(m);

  // If this was a map-click creation, open editor immediately
  if (editOnCreate) openNameEditor(m);

  if (!noRender) renderRoadbooksTable();

}


function clearMarkers() {
  markers.forEach(m => {
    removeLabelPopup(m);
    m.remove();
  });
  markers = [];
  renderRoadbooksTable();
}


function setRoadbookLabel(idx, newLabel) {
  const label = (newLabel || "").trim();
  if (!roadbookIdx.includes(idx)) return;

  roadbookLabels.set(idx, label || `#${idx}`);

  const m = markers.find(mm => mm.__idx === idx);
  if (m) ensureLabelPopup(m);  // refresh content & position
}



// ---------- Leg names ----------
function getLegKey(a, b) { return `${a}|${b}`; }
function getDefaultLegLabel(a, b) {
  return `${getWaypointName(a)} \u2192 ${getWaypointName(b)}`; // →
}


function setLegLabelByKey(key, label) {
  const txt = (label || "").trim();
  if (!txt) legLabels.delete(key);
  else legLabels.set(key, txt);
}

// ---------- Table render (grouped headers + editable fields) ----------
function renderRoadbooksTable() {
  if (!trackLatLngs.length || roadbookIdx.length < 2) {
    roadbooksEl.innerHTML = "";
    updateSummaryCard();
    return;
  }

  const lastIdx = trackLatLngs.length - 1;
  const legEntries = [];

  for (let k = 1; k < roadbookIdx.length; k++) {
    const aRaw = roadbookIdx[k - 1];
    const bRaw = roadbookIdx[k];
    const a = Math.max(0, Math.min(aRaw, lastIdx));
    const b = Math.max(0, Math.min(bRaw, lastIdx));
    const key = getLegKey(a, b);

    const dA = cumDistKm[a] ?? 0, dB = cumDistKm[b] ?? dA;
    const uA = cumAscentM[a] ?? 0, uB = cumAscentM[b] ?? uA;
    const vA = cumDescentM[a] ?? 0, vB = cumDescentM[b] ?? vA;
    const tA = cumTimeH[a] ?? 0, tB = cumTimeH[b] ?? tA;

    const distKm = dB - dA;
    const ascM   = uB - uA;
    const desM   = vB - vA;
    const timeH  = tB - tA;

    const stopsMin = legStopsMin.get(key) ?? 0;
    const condPct  = legCondPct.get(key) ?? 0;
    const totalH   = timeH * (1 + condPct / 100) + (stopsMin / 60);

    legEntries.push({ idx: k, a, b, key, distKm, ascM, desM, baseH: timeH, stopsMin, condPct, totalH });
  }

  const totalAdjustedH = legEntries.reduce((s, L) => s + L.totalH, 0);
  lastTotalAdjustedH = totalAdjustedH;

  let html = `
    <table>
      <thead>
        <tr>
          <th class="col-index" rowspan="2">#</th>
          <th rowspan="2">Name</th>
          <th rowspan="2">Critical</th>
          <th colspan="3">Leg</th>
          <th colspan="3">Accumulated</th>
          <th colspan="6">Time</th>
          <th rowspan="2">Observations</th>
        </tr>
        <tr>
          <th>d</th><th>↑</th><th>↓</th>
          <th>Σd</th><th>Σ↑</th><th>Σ↓</th>
          <th>t</th><th>Stops</th><th>Cond</th><th>Total</th><th>Σt</th><th>Rem</th>
        </tr>
      </thead>
      <tbody>
  `;

  let cumDistKmShown = 0, cumAscMShown = 0, cumDesMShown = 0, cumTimeAdjH = 0;

  for (const L of legEntries) {
    cumDistKmShown += L.distKm;
    cumAscMShown   += L.ascM;
    cumDesMShown   += L.desM;
    cumTimeAdjH    += L.totalH;

    const autoLabel    = getDefaultLegLabel(L.a, L.b);
    const displayLabel = legLabels.get(L.key) || autoLabel;
    const remainingH   = totalAdjustedH - cumTimeAdjH;
    const isCritical   = legCritical.get(L.key) ?? false;
    const obsText      = legObservations.get(L.key) ?? "";

    html += `
      <tr>
        <td class="col-index">${L.idx}</td>
        <td class="leg-cell">
          <span class="leg-name" contenteditable="true" data-legkey="${L.key}" spellcheck="false"
                title="Double-click to edit">${escapeHtml(displayLabel)}</span>
        </td>

        <td>
          <select class="wb-critical" data-legkey="${L.key}">
            <option value="No"${isCritical ? "" : " selected"}>No</option>
            <option value="Yes"${isCritical ? " selected" : ""}>Yes</option>
          </select>
        </td>

        <td>${fmtKm(L.distKm)}</td>
        <td>${Math.round(L.ascM)} m</td>
        <td>${Math.round(L.desM)} m</td>

        <td>${fmtKm(cumDistKmShown)}</td>
        <td>${Math.round(cumAscMShown)} m</td>
        <td>${Math.round(cumDesMShown)} m</td>

        <td>${fmtHrs(L.baseH)}</td>
        <td>
          <span class="editable wb-stops" contenteditable="true" data-legkey="${L.key}" spellcheck="false"
                title="Integer minutes">${escapeHtml(minutesToText(L.stopsMin))}</span>
        </td>
        <td>
          <span class="editable wb-cond" contenteditable="true" data-legkey="${L.key}" spellcheck="false"
                title="Integer percent">${escapeHtml(percentToText(L.condPct))}</span>
        </td>
        <td>${fmtHrs(L.totalH)}</td>
        <td>${fmtHrs(cumTimeAdjH)}</td>
        <td>${fmtHrs(remainingH)}</td>

        <td class="obs-cell">
          <span class="editable wb-obs" contenteditable="true" data-legkey="${L.key}" spellcheck="true"
                title="Add notes or comments">${escapeHtml(obsText)}</span>
        </td>
      </tr>
    `;
  }

  html += `</tbody></table>`;
  roadbooksEl.innerHTML = html;

  const wrap = document.getElementById('roadbooksTableWrap');
  if (wrap) wrap.dispatchEvent(new Event('scroll')); // triggers fade update


  bindLegEditors();
  bindTimeEditors();
  bindCriticalEditors();
  bindObservationEditors();
  updateSummaryCard();
}


// ---------- Editors ----------
function bindLegEditors() {
  const els = roadbooksEl.querySelectorAll('.leg-name');
  els.forEach(el => {
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
    el.addEventListener('blur', () => {
      const key = el.dataset.legkey;
      const txt = el.textContent || "";
      setLegLabelByKey(key, txt);
      renderRoadbooksTable();
    });
    el.addEventListener('focus', () => {
      const r = document.createRange(); r.selectNodeContents(el);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    });
  });
}

function bindTimeEditors() {
  // Stops (minutes)
  roadbooksEl.querySelectorAll('.wb-stops').forEach(el => {
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
    el.addEventListener('blur', () => {
      const key = el.dataset.legkey;
      const val = sanitizeInt(el.textContent, 0);
      legStopsMin.set(key, val);
      el.textContent = minutesToText(val);
      renderRoadbooksTable();
    });
    el.addEventListener('input', () => {
      el.textContent = el.textContent.replace(/[^\d]/g, '');
      const s = window.getSelection(); const r = document.createRange();
      r.selectNodeContents(el); r.collapse(false); s.removeAllRanges(); s.addRange(r);
    });
  });

  // Conditions (percent)
  roadbooksEl.querySelectorAll('.wb-cond').forEach(node => {
    const key = node.getAttribute('data-legkey');
    const save = () => {
      const pct = parseCondPercent(node.textContent || "");
      legCondPct.set(key, pct);
      // normalise display
      node.textContent = percentToText(pct);
      // Rebuild table so row totals / Σt / Rem update
      renderRoadbooksTable();
    };
    node.addEventListener('blur', save);
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault(); // avoid newline
        save();
        node.blur();
      }
    });
  });

}

function bindCriticalEditors() {
  roadbooksEl.querySelectorAll('.wb-critical').forEach(sel => {
    sel.addEventListener('change', () => {
      const key = sel.dataset.legkey;
      const yes = (sel.value === 'Yes');
      if (yes) legCritical.set(key, true);
      else legCritical.set(key, false);
    });
  });
}

function bindObservationEditors() {
  const nodes = roadbooksEl.querySelectorAll('.wb-obs');
  nodes.forEach(node => {
    const key = node.getAttribute('data-legkey');
    // Save on input (live) and on blur (final)
    const save = () => {
      const val = (node.textContent || "").trim();
      if (val) legObservations.set(key, val);
      else legObservations.delete(key);
    };
    node.addEventListener('input', save);
    node.addEventListener('blur', save);
  });
}


// ---------- Save / Load / Export CSV ----------
function serializePlan() {
  const legs = [];
  let cumDistKmShown = 0, cumAscMShown = 0, cumDesMShown = 0, cumTimeAdjH = 0;
  const lastIdx = trackLatLngs.length - 1;

  for (let k = 1; k < roadbookIdx.length; k++) {
    const aRaw = roadbookIdx[k - 1];
    const bRaw = roadbookIdx[k];
    const a = Math.max(0, Math.min(aRaw, lastIdx));
    const b = Math.max(0, Math.min(bRaw, lastIdx));
    const key = getLegKey(a, b);

    const dA = cumDistKm[a]   ?? 0, dB = cumDistKm[b]   ?? dA;
    const uA = cumAscentM[a]  ?? 0, uB = cumAscentM[b]  ?? uA;
    const vA = cumDescentM[a] ?? 0, vB = cumDescentM[b] ?? vA;
    const tA = cumTimeH[a]    ?? 0, tB = cumTimeH[b]    ?? tA;

    const distKm = dB - dA;
    const ascM   = uB - uA;
    const desM   = vB - vA;
    const baseH  = tB - tA;

    const stopsMin = legStopsMin.get(key) ?? 0;
    const condPct  = legCondPct.get(key) ?? 0;
    const name     = legLabels.get(key) || getDefaultLegLabel(a, b);
    const obs      = legObservations.get(key) ?? "";
    const totalH   = baseH * (1 + condPct / 100) + (stopsMin / 60);

    cumDistKmShown += distKm;
    cumAscMShown   += ascM;
    cumDesMShown   += desM;
    cumTimeAdjH    += totalH;

    legs.push({
      idx: k, a, b, key, name,
      distKm, ascM, desM, baseH, stopsMin, condPct, totalH,
      cumDistKm: cumDistKmShown, cumAscM: cumAscMShown, cumDesM: cumDesMShown, cumTimeAdjH,
      critical: !!(legCritical.get(key)),
      observations: obs
    });
  }

  const settings = {
    speedFlatKmh: parseFloat(document.getElementById("speedFlat")?.value) || 4,
    speedVertMh:  parseFloat(document.getElementById("speedVert")?.value)  || 300,
    downhillFactor: parseFloat(document.getElementById("downhillFactor")?.value) || 0.6667,
    spacingM: parseFloat(document.getElementById("spacingM")?.value) || 5,
    smoothWinM: parseFloat(document.getElementById("smoothWinM")?.value) || 35,
    elevDeadbandM: parseFloat(document.getElementById("elevDeadbandM")?.value) || 2,
    activity: document.getElementById("activityType")?.value || "hike"
  };

  return {
    version: 2,
    createdAt: new Date().toISOString(),
    gpxText: lastGpxText || null,               // <-- embed GPX here
    signature: trackSignature(),
    settings,
    meta: { gpxName: lastGpxName || null },
    roadbookIdx,
    roadbookLabels: Object.fromEntries(roadbookLabels),
    legLabels: Object.fromEntries(legLabels),
    legStopsMin: Object.fromEntries(legStopsMin),
    legCondPct: Object.fromEntries(legCondPct),
    legCritical: Object.fromEntries(legCritical),
    legObservations: Object.fromEntries(legObservations),
    legs
  };
}





async function restorePlanFromJSON(plan) {
  // If no current track, rebuild from embedded GPX first
  if (!trackLatLngs.length) {
    if (!plan.gpxText) {
      alert("This saved plan has no embedded GPX. Please process a GPX first, then load the plan.");
      return;
    }

    // Apply saved settings BEFORE processing (so resample/smooth match)
    const s = plan.settings || {};
    const setVal = (id, v) => { const el = document.getElementById(id); if (el != null && v != null) el.value = v; };
    setVal("activityType",   s.activity);
    setVal("speedFlat",      s.speedFlatKmh);
    setVal("speedVert",      s.speedVertMh);
    setVal("downhillFactor", s.downhillFactor);
    setVal("spacingM",       s.spacingM);
    setVal("smoothWinM",     s.smoothWinM);
    setVal("elevDeadbandM",  s.elevDeadbandM);

    try {
      // Build the track (do NOT import GPX waypoints; plan restores them)
      await processGpxText(plan.gpxText, /* importRoadbooks */ false);
    } catch (e) {
      console.error('Processing saved GPX failed:', e);
      alert("Failed to rebuild the track from the saved plan’s GPX.");
      return;
    }
  }

  // Optional sanity check
  try {
    const sig = trackSignature();
    if (plan.signature && sig && sig.n !== plan.signature.n) {
      console.warn("Saved plan may belong to a different GPX/settings. Legs may not align perfectly.");
    }
  } catch {}

  if (plan.meta && plan.meta.gpxName) {
  lastGpxName = plan.meta.gpxName;
}

// Restore roadbook data (take a snapshot, then rebuild from scratch)
const savedIdxArr = Array.isArray(plan.roadbookIdx) ? plan.roadbookIdx.slice() : [];
const savedLabels = new Map(Object.entries(plan.roadbookLabels || {}).map(([k,v]) => [Number(k), v]));
legLabels       = new Map(Object.entries(plan.legLabels      || {}));
legStopsMin     = new Map(Object.entries(plan.legStopsMin    || {}));
legCondPct      = new Map(Object.entries(plan.legCondPct     || {}));
legCritical     = new Map(Object.entries(plan.legCritical    || {}).map(([k,v]) => [k, !!v]));
legObservations = new Map(Object.entries(plan.legObservations|| {}));

// Start clean: remove any auto Start/Finish from processGpxText()
clearMarkers();
roadbookIdx = [];
roadbookLabels.clear();

// Rebuild markers + labels exactly as saved
for (const i of savedIdxArr) {
  const locked = (i === 0 || i === trackLatLngs.length - 1);
  addRoadbookIndex(i, { noRender: true, label: savedLabels.get(i), locked });
}

renderRoadbooksTable();
updateSummaryCard();
showMainSections(true);


  saveBtn   && (saveBtn.disabled = false);
  exportCsv && (exportCsv.disabled = false);
  printBtn  && (printBtn.disabled = false);
}





// Save current plan
if (saveBtn) {
  saveBtn.addEventListener('click', () => {
    if (!trackLatLngs.length) return;
    const data = serializePlan();

    // Prefer the uploaded GPX base name; else fall back to Start label / "route"
    const fallback = (roadbookLabels.get(0) || "route").replace(/[^\w\-]+/g, '_');
    const base = (lastGpxName || fallback).replace(/[^\w\-]+/g, '_');

    downloadFile(`${base}-timewisegpx.json`, 'application/json', JSON.stringify(data, null, 2));
  });
}


// Load saved plan (robust + clear diagnostics)
if (loadBtn && loadInput) {
  loadBtn.addEventListener('click', () => loadInput.click());
  loadInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const trimmed = String(text).trim();

      // User picked a GPX instead of plan JSON? Load as GPX.
      if (/^</.test(trimmed)) {
        await processGpxText(trimmed, /* importRoadbooks */ true);
        alert("Loaded a GPX file. (Tip: use Save to export a resumable plan JSON.)");
        return;
      }

      // Parse plan JSON (strip BOM if present)
      let plan;
      try {
        plan = safeParseJSON(text);
      } catch (parseErr) {
        console.error('JSON parse failed:', parseErr);
        alert("Could not parse the plan JSON. Make sure you selected a file saved by this app.");
        return;
      }

      // Must have embedded GPX for full restore
      if (!plan.gpxText && !trackLatLngs.length) {
        alert("This saved plan doesn’t contain embedded GPX. Process the original GPX once, then load the plan again.");
        return;
      }

      await restorePlanFromJSON(plan);
    } catch (err) {
      console.error('Load failed:', err);
      alert(`Could not load the file.\n\n${(err && err.message) ? err.message : ''}`);
    } finally {
      loadInput.value = "";
    }
  });
}





// Export table as CSV
if (exportCsv) {
  exportCsv.addEventListener('click', () => {
    const table = roadbooksEl.querySelector('table');
    if (!table) { alert('No table to export.'); return; }

    const rows = [];
    // headers
    table.querySelectorAll('thead tr').forEach(tr =>
      rows.push([...tr.children].map(th => th.textContent.trim()))
    );
    // body (respect <select> chosen text and editable spans)
    table.querySelectorAll('tbody tr').forEach(tr => {
      const cells = [...tr.children].map(td => {
        const sel = td.querySelector('select');
        if (sel) {
          const opt = sel.options[sel.selectedIndex];
          return (opt ? opt.text : sel.value || '');
        }
        const span = td.querySelector('span');
        if (span) return span.textContent.trim();
        return td.textContent.replace(/\s+/g,' ').trim();
      });
      rows.push(cells);
    });

    const csv = rows
      .map(r => r.map(v => /[",\n]/.test(v) ? `"${v.replace(/"/g,'""')}"` : v).join(','))
      .join('\n');
    downloadFile('roadbooks_table.csv', 'text/csv;charset=utf-8', csv);
  });
}



// ---------- GPX parsing ----------
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result);
    reader.readAsText(file);
  });
}

function parseGPXToSegments(gpxText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(gpxText, "application/xml");
  if (xml.querySelector("parsererror")) return [];

  const segNodes = [...xml.getElementsByTagName("trkseg")];
  let segments = [];

  if (segNodes.length) {
    segments = segNodes.map(seg => {
      const pts = [...seg.getElementsByTagName("trkpt")].map(pt => {
        const lat = parseFloat(pt.getAttribute("lat"));
        const lon = parseFloat(pt.getAttribute("lon"));
        const eleNode = pt.getElementsByTagName("ele")[0];
        const ele = eleNode ? parseFloat(eleNode.textContent) : null;
        return { lat, lon, ele: Number.isFinite(ele) ? ele : null };
      }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
      return pts;
    }).filter(arr => arr.length >= 2);
  } else {
    const rtepts = [...xml.getElementsByTagName("rtept")].map(pt => {
      const lat = parseFloat(pt.getAttribute("lat"));
      const lon = parseFloat(pt.getAttribute("lon"));
      const eleNode = pt.getElementsByTagName("ele")[0];
      const ele = eleNode ? parseFloat(eleNode.textContent) : null;
      return { lat, lon, ele: Number.isFinite(ele) ? ele : null };
    }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    if (rtepts.length >= 2) segments = [rtepts];
  }

  return segments;
}

function parseGPXRoadbooks(gpxText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(gpxText, "application/xml");
  const out = [];

  const wpts = [...xml.getElementsByTagName("wpt")];
  for (const w of wpts) {
    const lat = parseFloat(w.getAttribute("lat"));
    const lon = parseFloat(w.getAttribute("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const name = (
      w.getElementsByTagName("name")[0]?.textContent ||
      w.getElementsByTagName("cmt")[0]?.textContent ||
      w.getElementsByTagName("sym")[0]?.textContent || ""
    ).trim();
    out.push({ lat, lon, name });
  }

  const rtepts = [...xml.getElementsByTagName("rtept")];
  for (const r of rtepts) {
    const lat = parseFloat(r.getAttribute("lat"));
    const lon = parseFloat(r.getAttribute("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const name = (
      r.getElementsByTagName("name")[0]?.textContent ||
      r.getElementsByTagName("cmt")[0]?.textContent ||
      r.getElementsByTagName("sym")[0]?.textContent || ""
    ).trim();
    out.push({ lat, lon, name });
  }

  const trkpts = [...xml.getElementsByTagName("trkpt")];
  for (const t of trkpts) {
    const nameNode = (t.getElementsByTagName("name")[0] || t.getElementsByTagName("cmt")[0] || t.getElementsByTagName("sym")[0]);
    if (!nameNode) continue;
    const lat = parseFloat(t.getAttribute("lat"));
    const lon = parseFloat(t.getAttribute("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const name = nameNode.textContent.trim();
    if (name) out.push({ lat, lon, name });
  }

  return out;
}

// ---------- Geometry & filters ----------
function fillElevationOnPoints(points) {
  const out = points.map(p => ({ ...p }));
  let last = null;
  for (let i = 0; i < out.length; i++) {
    if (out[i].ele == null) out[i].ele = last;
    else last = out[i].ele;
  }
  let next = null;
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].ele == null) out[i].ele = next;
    else next = out[i].ele;
  }
  return out;
}

function resampleByDistance(points, spacingM) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    const d = haversineKm(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon) * 1000;
    cum.push(cum[i - 1] + d);
  }
  const total = cum[cum.length - 1];
  if (!isFinite(total) || total === 0) return points.slice(0, Math.min(points.length, 2));

  const targets = [];
  for (let s = 0; s <= total; s += spacingM) targets.push(s);
  if (targets[targets.length - 1] < total) targets.push(total);

  const out = [];
  let j = 1;
  for (const t of targets) {
    while (j < cum.length && cum[j] < t) j++;
    if (j >= cum.length) { out.push({ ...points[points.length - 1] }); continue; }
    const t0 = cum[j - 1], t1 = cum[j];
    const p0 = points[j - 1], p1 = points[j];
    const denom = (t1 - t0) || 1;
    const a = clamp((t - t0) / denom, 0, 1);

    const lat = p0.lat + a * (p1.lat - p0.lat);
    const lon = p0.lon + a * (p1.lon - p0.lon);
    const ele = (p0.ele != null && p1.ele != null) ? (p0.ele + a * (p1.ele - p0.ele)) : (p0.ele != null ? p0.ele : p1.ele);

    out.push({ lat, lon, ele });
  }
  return out;
}

function medianFilter(arr, win) {
  if (!Array.isArray(arr) || arr.length === 0) return arr.slice();
  const n = arr.length, half = Math.floor(win / 2), out = new Array(n);
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - half);
    const end   = Math.min(n - 1, i + half);
    const vals = [];
    for (let k = start; k <= end; k++) if (arr[k] != null) vals.push(arr[k]);
    if (!vals.length) { out[i] = null; continue; }
    vals.sort((a,b)=>a-b);
    const mid = Math.floor(vals.length / 2);
    out[i] = vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
  }
  return out;
}

function cumulativeDeadbandFilter(elev, deadband) {
  const n = elev.length;
  if (n === 0) return [];
  const out = new Array(n).fill(null);

  let first = elev[0], i0 = 0;
  while (first == null && i0 < n - 1) first = elev[++i0];
  if (first == null) return elev.slice();

  out[i0] = first;
  let cumErr = 0;

  for (let i = i0 + 1; i < n; i++) {
    const prev = elev[i - 1] ?? elev[i] ?? out[i - 1];
    const cur  = elev[i] ?? prev;
    const delta = cur - prev;
    cumErr += delta;

    if (Math.abs(cumErr) > deadband) {
      const move = cumErr - Math.sign(cumErr) * deadband;
      out[i] = out[i - 1] + move;
      cumErr = Math.sign(cumErr) * deadband;
    } else {
      out[i] = out[i - 1];
    }
  }
  for (let k = 0; k < i0; k++) out[k] = out[i0];
  return out;
}

// ---------- Utils ----------
function toPosNum(v, d) { const n = parseFloat(v); return n > 0 ? n : d; }
function toNonNegNum(v, d) { const n = parseFloat(v); return n >= 0 ? n : d; }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function clampToOdd(val, minOdd, maxOdd) { val = clamp(val, minOdd, maxOdd); if (val % 2 === 0) val += (val >= maxOdd ? -1 : 1); return val; }

function sanitizeInt(str, def = 0) { const m = String(str ?? "").match(/\d+/); const n = m ? parseInt(m[0], 10) : def; return Number.isFinite(n) && n >= 0 ? n : def; }
function minutesToText(min) { return `${min} min`; }

function safeParseJSON(text) {
  // Strip UTF-8 BOM if present
  const clean = String(text || '').replace(/^\uFEFF/, '');
  return JSON.parse(clean);
}


function percentToText(p) {
  const n = Number.isFinite(p) ? Math.round(p) : 0;
  return `${n} %`;
}

function parseCondPercent(str) {
  if (!str) return 0;
  // Accept forms like "-10", "-10%", " -10 % ", "+15", "15%"
  const m = String(str).trim().match(/^([+-]?\d{1,4})\s*%?$/);
  const raw = m ? parseInt(m[1], 10) : 0;
  // Clamp to sensible bounds so we never get pathological totals
  return Math.max(MIN_COND_PCT, Math.min(MAX_COND_PCT, raw));
}


function downloadFile(filename, mime, text) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function trackSignature() {
  if (!trackLatLngs.length) return null;
  const n = trackLatLngs.length;
  const first = trackLatLngs[0], last = trackLatLngs[n - 1];
  const spacingM = parseFloat(document.getElementById("spacingM")?.value) || 5;
  const smoothWinM = parseFloat(document.getElementById("smoothWinM")?.value) || 35;
  const elevDeadbandM = parseFloat(document.getElementById("elevDeadbandM")?.value) || 2;
  return { n, first, last, spacingM, smoothWinM, elevDeadbandM };
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtKm(km) { return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`; }
function fmtHrs(hours) {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")} h`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}


// Sum times per leg for summary: includes Conditions, optionally Stops
function computeTimeRollups() {
  if (!trackLatLngs.length || roadbookIdx.length < 2 || cumTimeH.length === 0) {
    const base = cumTimeH[cumTimeH.length - 1] ?? 0;
    return { baseH: base, activityWithCondH: base, stopsH: 0, totalH: base };
  }

  const lastIdx = trackLatLngs.length - 1;
  let baseSumH = 0;
  let activityWithCondH = 0;
  let stopsH = 0;

  for (let k = 1; k < roadbookIdx.length; k++) {
    const a = Math.max(0, Math.min(roadbookIdx[k - 1], lastIdx));
    const b = Math.max(0, Math.min(roadbookIdx[k], lastIdx));
    const key = `${a}|${b}`;

    const tA = cumTimeH[a] ?? 0;
    const tB = cumTimeH[b] ?? tA;
    const base = tB - tA;

    const condPct  = legCondPct.get(key)  ?? 0;
    const stopsMin = legStopsMin.get(key) ?? 0;

    baseSumH += base;
    activityWithCondH += base * (1 + condPct / 100);
    stopsH += (stopsMin / 60);
  }

  return {
    baseH: baseSumH,
    activityWithCondH,
    stopsH,
    totalH: activityWithCondH + stopsH
  };
}

// --- Table fade shadows for horizontal scroll UX ---
function wireTableFades(){
  const outer = document.querySelector('.table-outer');
  const wrap  = document.getElementById('roadbooksTableWrap');
  if (!outer || !wrap) return;

  const fadeL = outer.querySelector('.table-fade-left');
  const fadeR = outer.querySelector('.table-fade-right');

  function updateFades(){
    const max = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
    const x   = wrap.scrollLeft;

    // Use rounding tolerance so fractional layouts don’t leave the fade visible
    const atStart = x <= 1;                   // 0 or ~0
    const atEnd   = x >= max - 1;             // within 1px of the end

    if (fadeL) fadeL.style.opacity = atStart ? 0 : 1;
    if (fadeR) fadeR.style.opacity = (max <= 1 || atEnd) ? 0 : 1;
  }

  wrap.addEventListener('scroll', updateFades, { passive: true });
  window.addEventListener('resize', updateFades);

  // Recompute fades whenever the table is re-rendered
  const ro = new ResizeObserver(updateFades);
  ro.observe(wrap);

  // Also observe the table contents changing (when you rewrite innerHTML)
  const mo = new MutationObserver(updateFades);
  mo.observe(document.getElementById('roadbooks'), { childList: true, subtree: true });

  // Initial
  requestAnimationFrame(updateFades);
};


// --- Waypoint label helpers ---
function getWaypointName(idx) {
  // Prefer explicit label; else fallback to ordinal like "WP 3"
  if (roadbookLabels.has(idx)) return roadbookLabels.get(idx);
  const pos = roadbookIdx.indexOf(idx);
  return pos >= 0 ? `WP ${pos + 1}` : `WP ${idx}`;
}

function setWaypointName(idx, name) {
  const clean = String(name || '').trim();
  if (clean) roadbookLabels.set(idx, clean);
  else roadbookLabels.delete(idx);
}

// Build the label HTML shown above each marker (clickable)
function labelHtml(idx, name) {
  return `<button type="button" class="wb-label-btn" data-idx="${idx}">
            <span class="wb-name">${escapeHtml(name)}</span>
          </button>`;
}

// Ensure a marker has a permanent "label popup" above it.
// Reuses existing instance on rename; creates it if missing.
function ensureLabelPopup(marker) {
  const idx  = marker.__idx;
  const name = getWaypointName(idx);
  const html = `<button type="button" class="wb-label-btn" data-idx="${idx}">
                  <span class="wb-name">${escapeHtml(name)}</span>
                </button>`;

  // Create if missing
  if (!marker.__label) {
    marker.__label = L.popup({
      closeButton: false,
      autoClose: false,
      closeOnClick: false,
      interactive: true,
      className: 'wb-labelpop',
      offset: [0, -28],
      minWidth: 1,
      maxWidth: 10000,
      autoPan: false,
      keepInView: false
    }).setLatLng(marker.getLatLng());
    map.addLayer(marker.__label);
  }

  // Update content + position
  marker.__label.setLatLng(marker.getLatLng());
  marker.__label.setContent(html);

  // 👉 Attach AFTER Leaflet has measured & (re)rendered the DOM.
  // We wait two frames, call update(), then one more frame to bind.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (marker.__label && marker.__label.update) marker.__label.update();

      requestAnimationFrame(() => {
        const el = marker.__label.getElement?.();
        if (!el) return;

        // Only the button is interactive (wrapper is click-through via CSS)
        const btn = el.querySelector('.wb-label-btn');
        if (!btn) return;

        if (marker.__labelClickHandler) {
          btn.removeEventListener('click', marker.__labelClickHandler);
        }
        marker.__labelClickHandler = (e) => {
          e.preventDefault();
          e.stopPropagation?.();
          openNameEditor(marker);
        };
        btn.addEventListener('click', marker.__labelClickHandler);
      });
    });
  });
}





// Remove the label popup when a waypoint is deleted
function removeLabelPopup(marker) {
  if (marker && marker.__label) {
    map.removeLayer(marker.__label);
    marker.__label = null;
  }
}



// Attach an inline editor popup to a marker.
function openNameEditor(marker) {
  const idx = marker.__idx;
  const current = getWaypointName(idx);
  const html = `
    <div class="wb-edit-wrap" style="min-width:200px">
      <label style="display:block;font-size:12px;margin:0 0 6px;">Waypoint name</label>
      <input id="wb-edit-input" type="text" value="${escapeHtml(current)}"
             style="width:100%;padding:6px 8px;border:1px solid #ccc;border-radius:6px;" />
      <div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end">
        <button id="wb-edit-save"   style="all:unset;background:#2a7de1;color:#fff;border-radius:6px;padding:6px 10px;cursor:pointer">Save</button>
        <button id="wb-edit-cancel" style="all:unset;background:#eee;color:#333;border-radius:6px;padding:6px 10px;cursor:pointer">Cancel</button>
        <button id="wb-edit-delete" style="all:unset;background:#e5484d;color:#fff;border-radius:6px;padding:6px 10px;cursor:pointer">Delete</button>
      </div>
    </div>
  `;

  // 🆕 detached popup (not bound to the marker)
  const editor = L.popup({
    closeButton: false,
    autoClose: true,
    closeOnClick: false,
    autoPan: true,
    className: 'wb-editpop',
    offset: [0, -28]
  })
    .setLatLng(marker.getLatLng())
    .setContent(html)
    .openOn(map); // <- open on the map, not on the marker

  // After it renders, wire the buttons/keys
  requestAnimationFrame(() => {
    const root = editor.getElement?.();
    const input = root?.querySelector('#wb-edit-input');

    const closeEditor = () => {
      // remove this specific popup
      map.closePopup(editor);
    };
    const refreshLabel = () => {
      ensureLabelPopup(marker);
      renderRoadbooksTable();
    };

    const saveName = () => {
      const val = (input?.value ?? '').trim();
      setWaypointName(idx, val);
      closeEditor();
      refreshLabel();
    };
    const cancelEdit = () => { closeEditor(); refreshLabel(); };

    root?.querySelector('#wb-edit-save')?.addEventListener('click', (e) => { e.preventDefault(); saveName(); });
    root?.querySelector('#wb-edit-cancel')?.addEventListener('click', (e) => { e.preventDefault(); cancelEdit(); });
    root?.querySelector('#wb-edit-delete')?.addEventListener('click', (e) => {
      e.preventDefault();
      // Do the single confirmation here
      if (confirm('Are you sure you want to remove this waypoint?')) {
        deleteWaypoint(marker, true); // <-- tell deleteWaypoint it's already confirmed
        map.closePopup(editor);
      }
    });


    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); saveName(); }
      if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
    });

    // focus for quick typing
    input?.focus();
    input?.select();
  });
}



// Just wire events to the opener (dblclick / right-click)
function attachNameEditor(marker) {
  marker.off('dblclick');      // avoid double-binding
  marker.off('contextmenu');
  marker.on('dblclick', (e) => { e.originalEvent?.preventDefault?.(); openNameEditor(marker); });
  marker.on('contextmenu', (e) => { e.originalEvent?.preventDefault?.(); openNameEditor(marker); });
}



function updateSummaryCard() {
  if (!trackLatLngs.length || cumDistKm.length === 0) {
    outputEl.innerHTML = "";
    return;
  }

  // Totals from cumulative arrays
  const totalDistKm    = cumDistKm[cumDistKm.length - 1]    ?? 0;
  const totalAscentM   = cumAscentM[cumAscentM.length - 1]  ?? 0;
  const totalDescentM  = cumDescentM[cumDescentM.length - 1]?? 0;

  // Roll up times:
  // - baseH = pure model (no cond, no stops)
  // - activityWithCondH = includes Conditions, excludes Stops  ✅
  // - totalH = includes both Conditions + Stops
  const { activityWithCondH, totalH } = computeTimeRollups();

  // Config line
  const spacingM      = parseFloat(document.getElementById("spacingM")?.value)      || 5;
  const smoothWinM    = parseFloat(document.getElementById("smoothWinM")?.value)    || 35;
  const elevDeadbandM = parseFloat(document.getElementById("elevDeadbandM")?.value) || 2;

  outputEl.innerHTML = `
    <ul>
      <li><strong>Distance:</strong> ${fmtKm(totalDistKm)}</li>
      <li><strong>Ascent:</strong> ${Math.round(totalAscentM)} m</li>
      <li><strong>Descent:</strong> ${Math.round(totalDescentM)} m</li>
      <li><strong>Estimated Activity Time:</strong> ${fmtHrs(activityWithCondH)}</li>
      <li><strong>Estimated Total Time:</strong> ${fmtHrs(totalH)}</li>
    </ul>
  `;
}



// ---------- Nearest point ----------
function nearestIndexOnTrack([la, lo], latlngs) {
  let bestIdx = 0, bestD = Infinity;
  for (let i = 0; i < latlngs.length; i++) {
    const [lb, lob] = latlngs[i];
    const d = haversineKm(la, lo, lb, lob);
    if (d < bestD) { bestD = d; bestIdx = i; }
  }
  return bestIdx;
}



(function(){
  const root = document.documentElement;
  const key = 'gpxplanner-theme';
  const stored = localStorage.getItem(key);
  if (stored === 'dark' || stored === 'light') {
    root.setAttribute('data-theme', stored);
  }
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const current = root.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem(key, next);

    // ✅ Keep topo map light even in dark mode
    if (tileLayer && map) {
      tileLayer.setUrl('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png');
    }
  });
})();

