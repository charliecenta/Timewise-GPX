// js/table.js
// Renders the Roadbooks table, binds editors, updates summary card, fades, and exports CSV.

import {
  sanitizeInt, minutesToText, percentToText, parseCondPercent,
  escapeHtml, fmtKm, fmtHrs
} from './utils.js';
import { t } from './i18n.js';

const API = {
  // DOM
  roadbooksEl: null,
  outputEl: null,

  // Data/state (references)
  getTrackLatLngs: () => [],
  getCumDist: () => [],
  getCumAsc: () => [],
  getCumDes: () => [],
  getCumTime: () => [],

  roadbookIdx: null,            // Array (mutated here)
  roadbookLabels: null,         // Map   (read here)
  legLabels: null,              // Map   (mutated here)
  legStopsMin: null,            // Map   (mutated here)
  legCondPct: null,             // Map   (mutated here)
  legCritical: null,            // Map   (mutated here)
  legObservations: null,        // Map   (mutated here)

  // Helpers
  getWaypointName: (idx) => `WP ${idx}`,
  getLegKey: (a, b) => `${a}|${b}`,
  getDefaultLegLabel: (a, b) => `WP ${a} → WP ${b}`,

  // Notified when table is re-rendered (optional; used by fades)
  onRender: () => {},
};

export function bindTableAPI(bindings) {
  Object.assign(API, bindings);
}

/** Public: render the main Roadbooks table */
export function renderRoadbooksTable() {
  const trackLatLngs = API.getTrackLatLngs();
  const cumDistKm    = API.getCumDist();
  const cumAscentM   = API.getCumAsc();
  const cumDescentM  = API.getCumDes();
  const cumTimeH     = API.getCumTime();

  if (!trackLatLngs.length || API.roadbookIdx.length < 2) {
    API.roadbooksEl.innerHTML = "";
    updateSummaryCard();
    API.onRender?.();
    return;
  }

  const lastIdx = trackLatLngs.length - 1;
  const legEntries = [];

  for (let k = 1; k < API.roadbookIdx.length; k++) {
    const aRaw = API.roadbookIdx[k - 1];
    const bRaw = API.roadbookIdx[k];
    const a = Math.max(0, Math.min(aRaw, lastIdx));
    const b = Math.max(0, Math.min(bRaw, lastIdx));
    const key = API.getLegKey(a, b);

    const dA = cumDistKm[a]   ?? 0, dB = cumDistKm[b]   ?? dA;
    const uA = cumAscentM[a]  ?? 0, uB = cumAscentM[b]  ?? uA;
    const vA = cumDescentM[a] ?? 0, vB = cumDescentM[b] ?? vA;
    const tA = cumTimeH[a]    ?? 0, tB = cumTimeH[b]    ?? tA;

    const distKm = dB - dA;
    const ascM   = uB - uA;
    const desM   = vB - vA;
    const timeH  = tB - tA;

    const stopsMin = API.legStopsMin.get(key) ?? 0;
    const condPct  = API.legCondPct.get(key) ?? 0;
    const totalH   = timeH * (1 + condPct / 100) + (stopsMin / 60);

    legEntries.push({ idx: k, a, b, key, distKm, ascM, desM, baseH: timeH, stopsMin, condPct, totalH });
  }

  const totalAdjustedH = legEntries.reduce((s, L) => s + L.totalH, 0);

  let html = `
    <table>
      <thead>
        <tr>
          <th class="col-index" rowspan="2">${t('table.headers.index')}</th>
          <th rowspan="2">Name</th>
          <th rowspan="2">${t('table.headers.critical')}</th>
          <th colspan="3">${t('table.headers.leg')}</th>
          <th colspan="3">${t('table.headers.accumulated')}</th>
          <th colspan="6">${t('table.headers.time')}</th>
          <th rowspan="2">${t('table.headers.observations')}</th>
        </tr>
        <tr>
          <th>${t('table.headers.legDistance')}</th><th>${t('table.headers.legAscent')}</th><th>${t('table.headers.legDescent')}</th>
          <th>${t('table.headers.accDistance')}</th><th>${t('table.headers.accAscent')}</th><th>${t('table.headers.accDescent')}</th>
          <th>${t('table.headers.timeBase')}</th><th>${t('table.headers.timeStops')}</th><th>${t('table.headers.timeCond')}</th><th>${t('table.headers.timeTotal')}</th><th>${t('table.headers.timeAccumulated')}</th><th>${t('table.headers.timeRemaining')}</th>
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

    const autoLabel    = API.getDefaultLegLabel(L.a, L.b);
    const displayLabel = API.legLabels.get(L.key) || autoLabel;
    const remainingH   = totalAdjustedH - cumTimeAdjH;
    const isCritical   = API.legCritical.get(L.key) ?? false;
    const obsText      = API.legObservations.get(L.key) ?? "";

    html += `
      <tr>
        <td class="col-index">${L.idx}</td>

        <td class="leg-cell editable-cell">
          <span class="leg-name" contenteditable="true" data-legkey="${L.key}" spellcheck="false"
                title="${t('table.tooltips.editName')}">${escapeHtml(displayLabel)}</span>
        </td>

        <td class="critical-cell ${isCritical ? 'critical-on' : ''}">
          <label class="crit-wrap" title="${t('table.tooltips.markCritical')}">
            <input type="checkbox"
                  class="wb-critical"
                  data-legkey="${L.key}"
                  ${isCritical ? 'checked' : ''} />
          </label>
        </td>

        <td>${fmtKm(L.distKm)}</td>
        <td>${Math.round(L.ascM)} m</td>
        <td>${Math.round(L.desM)} m</td>

        <td>${fmtKm(cumDistKmShown)}</td>
        <td>${Math.round(cumAscMShown)} m</td>
        <td>${Math.round(cumDesMShown)} m</td>

        <td>${fmtHrs(L.baseH)}</td>

        <td class="editable-cell">
          <span class="wb-stops" contenteditable="true" data-legkey="${L.key}" spellcheck="false"
                title="${t('table.tooltips.stops')}">${escapeHtml(minutesToText(L.stopsMin))}</span>
        </td>
        <td class="editable-cell">
          <span class="wb-cond" contenteditable="true" data-legkey="${L.key}" spellcheck="false"
                title="${t('table.tooltips.conditions')}">${escapeHtml(percentToText(L.condPct))}</span>
        </td>

        <td>${fmtHrs(L.totalH)}</td>
        <td>${fmtHrs(cumTimeAdjH)}</td>
        <td>${fmtHrs(remainingH)}</td>

        <td class="obs-cell editable-cell">
          <span class="wb-obs" contenteditable="true" data-legkey="${L.key}" spellcheck="true"
                title="${t('table.tooltips.observations')}">${escapeHtml(obsText)}</span>
        </td>
      </tr>
    `;
  }

  html += `</tbody></table>`;
  API.roadbooksEl.innerHTML = html;

  // Let the host update fades etc.
  API.onRender?.();

  // Bind editors
  bindLegEditors();
  bindTimeEditors();
  bindCriticalEditors();
  bindObservationEditors();

  // Update summary
  updateSummaryCard();
}

/** Public: update summary card (uses Conditions; excludes Stops for Activity time) */
export function updateSummaryCard() {
  const trackLatLngs = API.getTrackLatLngs();
  const cumDistKm    = API.getCumDist();
  const cumAscentM   = API.getCumAsc();
  const cumDescentM  = API.getCumDes();

  if (!trackLatLngs.length || cumDistKm.length === 0) {
    API.outputEl.innerHTML = "";
    return;
  }

  const totals = {
    distKm:   cumDistKm[cumDistKm.length - 1]   ?? 0,
    ascM:     cumAscentM[cumAscentM.length - 1] ?? 0,
    desM:     cumDescentM[cumDescentM.length - 1] ?? 0,
  };
  const roll = computeTimeRollups();

  API.outputEl.innerHTML = `
    <ul>
      <li><strong>${t('summary.distance')}:</strong> ${fmtKm(totals.distKm)}</li>
      <li><strong>${t('summary.ascent')}:</strong> ${Math.round(totals.ascM)} m</li>
      <li><strong>${t('summary.descent')}:</strong> ${Math.round(totals.desM)} m</li>
      <li><strong>${t('summary.activityTime')}:</strong> ${fmtHrs(roll.activityWithCondH)}</li>
      <li><strong>${t('summary.totalTime')}:</strong> ${fmtHrs(roll.totalH)}</li>
    </ul>
  `;
}

/** Public: hook fade shadows on the horizontal scroll wrapper */
export function wireTableFades() {
  const outer = document.querySelector('.table-outer');
  const wrap  = document.getElementById('roadbooksTableWrap');
  if (!outer || !wrap) return;

  const fadeL = outer.querySelector('.table-fade-left');
  const fadeR = outer.querySelector('.table-fade-right');

  function updateFades(){
    const max = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
    const x   = wrap.scrollLeft;
    const atStart = x <= 1;
    const atEnd   = x >= max - 1;
    if (fadeL) fadeL.style.opacity = atStart ? 0 : 1;
    if (fadeR) fadeR.style.opacity = (max <= 1 || atEnd) ? 0 : 1;
  }

  wrap.addEventListener('scroll', updateFades, { passive: true });
  window.addEventListener('resize', updateFades);

  // Recompute when table re-renders
  const ro = new ResizeObserver(updateFades);
  ro.observe(wrap);

  const mo = new MutationObserver(updateFades);
  mo.observe(API.roadbooksEl, { childList: true, subtree: true });

  // initial
  requestAnimationFrame(updateFades);
}

/** Public: export the current table to CSV */
export function exportRoadbooksCsv() {
  const table = API.roadbooksEl.querySelector('table');
  if (!table) { alert(t('table.csv.noTable')); return null; }

  const rows = [];
  const headers = [
    t('table.headers.index'),
    t('table.headers.name'),
    t('table.headers.critical'),
    `${t('table.headers.leg')} – ${t('table.headers.legDistance')}`,
    `${t('table.headers.leg')} – ${t('table.headers.legAscent')}`,
    `${t('table.headers.leg')} – ${t('table.headers.legDescent')}`,
    `${t('table.headers.accumulated')} – ${t('table.headers.accDistance')}`,
    `${t('table.headers.accumulated')} – ${t('table.headers.accAscent')}`,
    `${t('table.headers.accumulated')} – ${t('table.headers.accDescent')}`,
    `${t('table.headers.time')} – ${t('table.headers.timeBase')}`,
    `${t('table.headers.time')} – ${t('table.headers.timeStops')}`,
    `${t('table.headers.time')} – ${t('table.headers.timeCond')}`,
    `${t('table.headers.time')} – ${t('table.headers.timeTotal')}`,
    `${t('table.headers.time')} – ${t('table.headers.timeAccumulated')}`,
    `${t('table.headers.time')} – ${t('table.headers.timeRemaining')}`,
    t('table.headers.observations'),
  ];
  rows.push(headers);

  const rowLength = headers.length;
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
    while (cells.length < rowLength) cells.push('');
    if (cells.length > rowLength) cells.length = rowLength;
    rows.push(cells);
  });

  const csv = rows
    .map(r => r.map(v => /[",\n]/.test(v) ? `"${v.replace(/"/g,'""')}"` : v).join(','))
    .join('\n');
  return csv;
}

/* ---------- internal helpers (editors + rollups) ---------- */

function bindLegEditors() {
  API.roadbooksEl.querySelectorAll('.leg-name').forEach(el => {
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
    el.addEventListener('blur', () => {
      const key = el.dataset.legkey;
      const txt = el.textContent || "";
      if (!txt.trim()) API.legLabels.delete(key);
      else API.legLabels.set(key, txt.trim());
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
  API.roadbooksEl.querySelectorAll('.wb-stops').forEach(el => {
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
    el.addEventListener('blur', () => {
      const key = el.dataset.legkey;
      const val = sanitizeInt(el.textContent, 0);
      API.legStopsMin.set(key, val);
      el.textContent = minutesToText(val);
      renderRoadbooksTable();
    });
    el.addEventListener('input', () => {
      el.textContent = el.textContent.replace(/[^\d]/g, '');
      const s = window.getSelection(); const r = document.createRange();
      r.selectNodeContents(el); r.collapse(false); s.removeAllRanges(); s.addRange(r);
    });
  });

  // Conditions (percent, allow negatives)
  API.roadbooksEl.querySelectorAll('.wb-cond').forEach(node => {
    const key = node.getAttribute('data-legkey');
    const save = () => {
      const pct = parseCondPercent(node.textContent || "");
      API.legCondPct.set(key, pct);
      node.textContent = percentToText(pct);
      renderRoadbooksTable();
    };
    node.addEventListener('blur', save);
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); save(); node.blur(); }
    });
  });
}

function bindCriticalEditors() {
  API.roadbooksEl.querySelectorAll('.wb-critical').forEach(cb => {
    cb.addEventListener('change', () => {
      const key = cb.getAttribute('data-legkey');
      const checked = cb.checked;
      API.legCritical.set(key, checked);
      const cell = cb.closest('td');
      if (cell) cell.classList.toggle('critical-on', checked);
    });
  });
}

function bindObservationEditors() {
  const nodes = API.roadbooksEl.querySelectorAll('.wb-obs');
  nodes.forEach(node => {
    const key = node.getAttribute('data-legkey');
    const save = () => {
      const val = (node.textContent || "").trim();
      if (val) API.legObservations.set(key, val);
      else API.legObservations.delete(key);
    };
    node.addEventListener('input', save);
    node.addEventListener('blur', save);
  });
}

function computeTimeRollups() {
  const trackLatLngs = API.getTrackLatLngs();
  const cumTimeH     = API.getCumTime();
  if (!trackLatLngs.length || API.roadbookIdx.length < 2 || cumTimeH.length === 0) {
    const base = cumTimeH[cumTimeH.length - 1] ?? 0;
    return { baseH: base, activityWithCondH: base, stopsH: 0, totalH: base };
    }

  const lastIdx = trackLatLngs.length - 1;
  let baseSumH = 0, activityWithCondH = 0, stopsH = 0;

  for (let k = 1; k < API.roadbookIdx.length; k++) {
    const a = Math.max(0, Math.min(API.roadbookIdx[k - 1], lastIdx));
    const b = Math.max(0, Math.min(API.roadbookIdx[k], lastIdx));
    const key = API.getLegKey(a, b);

    const tA = cumTimeH[a] ?? 0;
    const tB = cumTimeH[b] ?? tA;
    const base = tB - tA;

    const condPct  = API.legCondPct.get(key)  ?? 0;
    const stopsMin = API.legStopsMin.get(key) ?? 0;

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
