// js/map.js
// Leaflet map + markers + labels (no printing). Self-contained and wired by bindMapAPI().

import { t } from './i18n.js';

let map, tileLayer, polyline;
let lastFitPadding = [20, 20];
let markers = [];

/** External references provided by the host (script.js). */
const API = {
  // data accessors
  getTrackLatLngs: () => [],
  roadbookIdx: null,             // Array reference (mutated by us)
  roadbookLabels: null,          // Map reference (mutated by us)

  // helpers from host
  renderRoadbooksTable: () => {},
  nearestIndexOnTrack: (_latlng, _track) => 0,
  escapeHtml: s => String(s),

  // naming + persistence
  getWaypointName: (_idx) => `${t('map.autoPrefix')}`,
  setWaypointName: (_idx, _name) => {},
  setRoadbookLabel: (_idx, _label) => {},

  // confirming delete (host may use a custom UI later)
  confirmDelete: (msg) => window.confirm(msg),

  // optional click handler for custom routing modes
  onMapClick: null,
};

/** Call this once from script.js to wire shared state & helpers. */
export function bindMapAPI(bindings) {
  Object.assign(API, bindings);
}

export function invalidateMapSize() {
  if (map && map.invalidateSize) {
    map.invalidateSize();
  }
}

/** Ensure Leaflet map exists; set OpenTopoMap tile layer; wire click-to-add. */
export function ensureMap() {
  if (map) return map;

  map = L.map('map');

  tileLayer = L.tileLayer(
    'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 17,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
        '<a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
    }
  ).addTo(map);

  map.setView([45.0, 7.0], 6);

  // One left click on the map → create waypoint at nearest track point and open editor
  map.on('click', (e) => {
    if (typeof API.onMapClick === 'function' && API.onMapClick(e)) return;
    const track = API.getTrackLatLngs();
    if (!track || !track.length) return;
    const idx = API.nearestIndexOnTrack([e.latlng.lat, e.latlng.lng], track);
    addRoadbookIndex(idx, { editOnCreate: true });
  });

  return map;
}

/** Draw/replace the main polyline and fit bounds. */
export function drawPolyline(latlngs) {
  if (!map) ensureMap();
  if (polyline) polyline.remove();

  polyline = L.polyline(latlngs, { weight: 4, color: '#2a7de1' }).addTo(map);

  try {
    const bounds = polyline.getBounds();
    const doFit = () => {
      map.fitBounds(bounds, { padding: lastFitPadding, maxZoom: 14 });
    };
    // If Leaflet is already ready, fit now; otherwise fit on first load
    if (map._loaded) doFit();
    else map.once('load', doFit);
  } catch {}
}

export function clearPolyline() {
  if (polyline) {
    polyline.remove();
    polyline = null;
  }
}


export function refitToTrack(padding = [20, 20]) {
  if (!map || !polyline) return;
  lastFitPadding = padding;
  try {
    map.fitBounds(polyline.getBounds(), { padding, maxZoom: 14 });
    //map.setZoom(Math.max(map.getMinZoom?.() ?? 0, map.getZoom() - 1));
  } catch {}
}



/** Remove all markers + label popups from the map. */
export function clearMarkers() {
  markers.forEach(m => {
    removeLabelPopup(m);
    m.remove();
  });
  markers = [];
  API.renderRoadbooksTable();
}

/** Set the basemap URL again (used on theme changes if needed). */
export function refreshTiles() {
  if (tileLayer) tileLayer.setUrl('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png');
}

/** Icon shared by all markers. */
const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconSize: [25, 41],
  iconAnchor: [12.5, 41],
});

/** Add a waypoint at resampled index i. Accepts {label, locked, noRender, editOnCreate}. */
export function addRoadbookIndex(i, opts = {}) {
  const { noRender = false, label = "", locked = false, editOnCreate = false } = opts;

  const track = API.getTrackLatLngs();
  if (!track || !track.length) return;

  i = Math.max(0, Math.min(track.length - 1, Math.round(i)));

  const arr = API.roadbookIdx;
  const labels = API.roadbookLabels;

  // If index exists, maybe update label & bail
  if (arr.includes(i)) {
    const newLabel = (label || "").trim();
    if (newLabel && (!labels.get(i) || labels.get(i) === `#${i}`)) {
      API.setRoadbookLabel(i, newLabel);
    }
    if (!noRender) API.renderRoadbooksTable();
    return;
  }

  arr.push(i);
  arr.sort((a, b) => a - b);

  const initial = (label && String(label).trim()) ||
                  labels.get(i) ||
                  (i === 0 ? t('map.start') :
                   i === track.length - 1 ? t('map.finish') :
                   `${t('map.autoPrefix')} ${arr.indexOf(i) + 1}`);

  labels.set(i, initial);

  const m = L.marker(track[i], { icon: markerIcon }).addTo(map);
  m.__idx = i;
  m.__locked = locked;

  if (label) API.setWaypointName(i, label);

  // Always-open label popup above the pin
  ensureLabelPopup(m);

  // Disable marker clicks (label handles editing)
  m.off('click'); m.off('dblclick');
  m.on('click', (e) => { e.originalEvent?.stopPropagation(); e.originalEvent?.preventDefault(); return false; });
  m.on('dblclick', (e) => { e.originalEvent?.stopPropagation(); e.originalEvent?.preventDefault(); return false; });

  m.unbindPopup();
  ensureLabelPopup(m);
  markers.push(m);

  if (editOnCreate) openNameEditor(m);
  if (!noRender) API.renderRoadbooksTable();
}

/** Build label HTML, centred above the marker (clickable button opens editor). */
function labelHtml(idx, name) {
  return `<button type="button" class="wb-label-btn" data-idx="${idx}">
            <span class="wb-name">${API.escapeHtml(name)}</span>
          </button>`;
}

/** Ensure a marker has a “permanent” label popup and wire the label click → editor. */
export function ensureLabelPopup(marker) {
  const idx  = marker.__idx;
  const name = API.getWaypointName(idx);
  const html = labelHtml(idx, name);

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

  marker.__label.setLatLng(marker.getLatLng());
  marker.__label.setContent(html);

  // Bind after layout so Leaflet computes sizes
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (marker.__label && marker.__label.update) marker.__label.update();
      requestAnimationFrame(() => {
        const el = marker.__label.getElement?.();
        const btn = el?.querySelector('.wb-label-btn');
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

/** Remove the label popup layer from the map. */
export function removeLabelPopup(marker) {
  if (marker && marker.__label) {
    map.removeLayer(marker.__label);
    marker.__label = null;
  }
}

/** Delete a waypoint (with confirmation handled here). */
export function deleteWaypoint(marker, confirmed = false) {
  if (marker.__locked) return;
  if (!confirmed && !API.confirmDelete(t('map.confirmDelete'))) return;

  const arr = API.roadbookIdx;
  const labels = API.roadbookLabels;

  const pos = arr.indexOf(marker.__idx);
  if (pos >= 0) arr.splice(pos, 1);

  removeLabelPopup(marker);

  const mi = markers.findIndex(mm => mm.__idx === marker.__idx);
  if (mi >= 0) { markers[mi].remove(); markers.splice(mi, 1); }

  // Host is responsible for clearing per-leg maps since it owns those maps.
  API.renderRoadbooksTable();
}

/** Inline editor popup (Save / Cancel / Delete). */
export function openNameEditor(marker) {
  const idx = marker.__idx;
  const current = API.getWaypointName(idx);

  const html = `
    <div class="wb-edit-wrap" style="min-width:200px">
      <label style="display:block;font-size:12px;margin:0 0 6px;">${t('map.editor.heading')}</label>
      <input id="wb-edit-input" type="text" value="${API.escapeHtml(current)}"
             style="width:100%;padding:6px 8px;border:1px solid #ccc;border-radius:6px;" />
      <div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end">
        <button id="wb-edit-save"   style="all:unset;background:#2a7de1;color:#fff;border-radius:6px;padding:6px 10px;cursor:pointer">${t('buttons.editor.save')}</button>
        <button id="wb-edit-cancel" style="all:unset;background:#eee;color:#333;border-radius:6px;padding:6px 10px;cursor:pointer">${t('buttons.editor.cancel')}</button>
        <button id="wb-edit-delete" style="all:unset;background:#e5484d;color:#fff;border-radius:6px;padding:6px 10px;cursor:pointer">${t('buttons.editor.delete')}</button>
      </div>
    </div>
  `;

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
    .openOn(map);

  requestAnimationFrame(() => {
    const root = editor.getElement?.();
    const input = root?.querySelector('#wb-edit-input');

    const closeEditor = () => map.closePopup(editor);
    const refresh     = () => { ensureLabelPopup(marker); API.renderRoadbooksTable(); };

    const saveName = () => { API.setWaypointName(idx, (input?.value ?? "").trim()); closeEditor(); refresh(); };
    const cancel   = () => { closeEditor(); refresh(); };

    root?.querySelector('#wb-edit-save')?.addEventListener('click', (e) => { e.preventDefault(); saveName(); });
    root?.querySelector('#wb-edit-cancel')?.addEventListener('click', (e) => { e.preventDefault(); cancel(); });
    root?.querySelector('#wb-edit-delete')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (API.confirmDelete(t('map.confirmDelete'))) {
        deleteWaypoint(marker, true);
        map.closePopup(editor);
      }
    });

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); saveName(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });

    input?.focus();
    input?.select();
  });
}

/** Utility so host can iterate markers if needed. */
export function getMarkers() { return markers.slice(); }
export function getMap()     { return map; }
export function getPolyline(){ return polyline; }
