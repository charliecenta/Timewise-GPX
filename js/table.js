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
  getTrackElev: () => [],

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
  const criticalLabel = t('table.labels.yes');

  let html = `
    <table>
      <thead>
        <tr>
          <th class="col-index" rowspan="2">${t('table.headers.index')}</th>
          <th rowspan="2">${t('table.headers.name')}</th>
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

        <td class="critical-cell ${isCritical ? 'critical-on' : ''}" data-critical-label="${escapeHtml(criticalLabel)}">
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
  const activity = API.getActivityType ? API.getActivityType() : 'hike';
  const formulaText = t(`summary.formulas.${activity}`, {}, '');
  const formulaHeading = t('summary.formulaHeading');
  const formulaHtml = formulaText ? `
    <div class="summary-formula">
      <p class="summary-formula-heading">${escapeHtml(formulaHeading)}</p>
      <p class="summary-formula-text"><em>${escapeHtml(formulaText)}</em></p>
    </div>
  ` : '';

  const profile = renderElevationProfile({
    distKm: cumDistKm,
    elevM: API.getTrackElev?.() ?? [],
    title: t('summary.elevationProfile'),
    roadbookIdx: API.roadbookIdx,
    getWaypointName: API.getWaypointName,
  });

  API.outputEl.innerHTML = `
    <ul>
      <li><strong>${t('summary.distance')}:</strong> ${fmtKm(totals.distKm)}</li>
      <li><strong>${t('summary.ascent')}:</strong> ${Math.round(totals.ascM)} m</li>
      <li><strong>${t('summary.descent')}:</strong> ${Math.round(totals.desM)} m</li>
      <li><strong>${t('summary.activityTime')}:</strong> ${fmtHrs(roll.activityWithCondH)}</li>
      <li><strong>${t('summary.totalTime')}:</strong> ${fmtHrs(roll.totalH)}</li>
    </ul>
    ${profile.html}
    ${formulaHtml}
  `;

  profile.afterRender?.(API.outputEl.querySelector('.summary-elevation'));
}

function renderElevationProfile({ distKm = [], elevM = [], title = '', roadbookIdx = [], getWaypointName = () => '' }) {
  const pairs = distKm.map((d, i) => ({ d, e: elevM[i] }))
    .filter(p => Number.isFinite(p.d) && Number.isFinite(p.e));

  if (pairs.length < 2) return { html: '' };

  const totalDist = pairs[pairs.length - 1].d;
  if (!Number.isFinite(totalDist) || totalDist <= 0) return { html: '' };

  const rawMinElev = Math.min(...pairs.map(p => p.e));
  const rawMaxElev = Math.max(...pairs.map(p => p.e));
  const elevStep = chooseNiceStep(rawMaxElev - rawMinElev, 5);
  const minElev = Math.floor(rawMinElev / elevStep) * elevStep;
  const maxElev = Math.ceil(rawMaxElev / elevStep) * elevStep;
  const elevRange = Math.max(1, maxElev - minElev);

  const width = 720;
  const height = 260;
  const padX = 48;
  const padY = 26;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const baseY = padY + innerH;

  const toX = (d) => padX + (d / totalDist) * innerW;
  const toY = (e) => padY + (1 - ((e - minElev) / elevRange)) * innerH;

  const first = pairs[0];
  let areaD = `M ${toX(first.d).toFixed(1)} ${baseY.toFixed(1)} L ${toX(first.d).toFixed(1)} ${toY(first.e).toFixed(1)}`;
  let lineD = `M ${toX(first.d).toFixed(1)} ${toY(first.e).toFixed(1)}`;

  for (let i = 1; i < pairs.length; i++) {
    const { d, e } = pairs[i];
    const x = toX(d).toFixed(1);
    const y = toY(e).toFixed(1);
    areaD += ` L ${x} ${y}`;
    lineD += ` L ${x} ${y}`;
  }

  const last = pairs[pairs.length - 1];
  areaD += ` L ${toX(last.d).toFixed(1)} ${baseY.toFixed(1)} Z`;

  const kmLabel = `${totalDist.toFixed(2)} km`;
  const elevLabel = `${Math.round(minElev)}–${Math.round(maxElev)} m`;

  const distStep = chooseNiceStep(totalDist, 6);
  const distTicks = makeTicks(0, totalDist, distStep);
  const elevTicks = makeTicks(minElev, maxElev, elevStep);
  const distDecimals = distStep < 1 ? (distStep < 0.1 ? 2 : 1) : 0;

  const roadbookMarkers = roadbookIdx
    .map(idx => ({ idx, dist: distKm[idx], label: getWaypointName(idx) }))
    .filter(r => Number.isFinite(r.dist))
    .filter((r, i, arr) => arr.findIndex(o => Math.abs(o.dist - r.dist) < 1e-6) === i);

  const areaId = `elev-fill-${Math.random().toString(36).slice(2, 8)}`;

  const html = `
    <div class="summary-elevation" aria-label="${escapeHtml(title)}">
      <div class="summary-elevation__header">
        <span class="summary-elevation__title">${escapeHtml(title)}</span>
        <span class="summary-elevation__meta">${escapeHtml(kmLabel)} · ${escapeHtml(elevLabel)}</span>
      </div>
      <div class="summary-elevation__body">
        <svg class="summary-elevation__plot" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}">
          <defs>
            <linearGradient id="${areaId}" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.32" />
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.05" />
            </linearGradient>
          </defs>
          <rect x="${padX}" y="${padY}" width="${innerW}" height="${innerH}" fill="var(--map-bg)" stroke="var(--card-border)" stroke-width="1" rx="8" ry="8" />
          <g class="summary-elevation__grid">
            ${distTicks.map(d => `<line x1="${toX(d).toFixed(1)}" y1="${padY}" x2="${toX(d).toFixed(1)}" y2="${baseY}" />`).join('')}
            ${elevTicks.map(e => `<line x1="${padX}" y1="${toY(e).toFixed(1)}" x2="${padX + innerW}" y2="${toY(e).toFixed(1)}" />`).join('')}
          </g>
          <path d="${areaD}" fill="url(#${areaId})" stroke="none" />
          <path d="${lineD}" class="summary-elevation__line" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          <g class="summary-elevation__axes" fill="var(--muted)" font-size="12" font-weight="600">
            ${distTicks.map(d => `<text x="${toX(d).toFixed(1)}" y="${baseY + 16}" text-anchor="${d === 0 ? 'start' : (d >= totalDist ? 'end' : 'middle')}">${escapeHtml(d === 0 ? '0 km' : `${d.toFixed(distDecimals)} km`)}</text>`).join('')}
            ${elevTicks.map(e => `<text x="${padX - 8}" y="${toY(e).toFixed(1) + 4}" text-anchor="end">${Math.round(e)} m</text>`).join('')}
          </g>
          <g class="summary-elevation__roadbooks" fill="var(--accent-strong)" font-size="12" font-weight="700">
            ${roadbookMarkers.map(r => `
              <line x1="${toX(r.dist).toFixed(1)}" y1="${padY}" x2="${toX(r.dist).toFixed(1)}" y2="${baseY}" />
              <text x="${toX(r.dist).toFixed(1)}" y="${padY - 6}" text-anchor="middle">${escapeHtml(r.label)}</text>
            `).join('')}
          </g>
          <g class="summary-elevation__hover">
            <line class="hover-line" x1="${padX}" x2="${padX}" y1="${padY}" y2="${baseY}" />
            <circle class="hover-dot" cx="${padX}" cy="${padY}" r="5" />
          </g>
        </svg>
        <div class="summary-elevation__tooltip" role="presentation" hidden></div>
      </div>
    </div>
  `;

  const afterRender = (root) => {
    if (!root) return;
    const svg = root.querySelector('svg');
    const tooltip = root.querySelector('.summary-elevation__tooltip');
    const hoverLine = root.querySelector('.hover-line');
    const hoverDot = root.querySelector('.hover-dot');
    if (!svg || !tooltip || !hoverLine || !hoverDot) return;

    const distances = pairs.map(p => p.d);
    const elevations = pairs.map(p => p.e);

    function findNearestIndex(target) {
      let lo = 0, hi = distances.length - 1;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (distances[mid] < target) lo = mid + 1; else hi = mid;
      }
      if (lo > 0 && Math.abs(distances[lo - 1] - target) < Math.abs(distances[lo] - target)) return lo - 1;
      return lo;
    }

    function slopePct(i) {
      if (i <= 0 || i >= elevations.length) return 0;
      const dKm = distances[i] - distances[i - 1];
      const dM = dKm * 1000;
      if (!dM) return 0;
      const dEle = elevations[i] - elevations[i - 1];
      return (dEle / dM) * 100;
    }

    function updateTooltip(evt) {
      const rect = svg.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      const y = evt.clientY - rect.top;
      if (x < padX || x > padX + innerW || y < padY || y > baseY) {
        tooltip.hidden = true;
        hoverLine.style.display = 'none';
        hoverDot.style.display = 'none';
        return;
      }

      const dist = ((x - padX) / innerW) * totalDist;
      const idx = findNearestIndex(dist);
      const d = distances[idx];
      const e = elevations[idx];
      const s = slopePct(idx);

      const cx = toX(d);
      const cy = toY(e);

      hoverLine.style.display = 'block';
      hoverDot.style.display = 'block';
      hoverLine.setAttribute('x1', cx);
      hoverLine.setAttribute('x2', cx);
      hoverDot.setAttribute('cx', cx);
      hoverDot.setAttribute('cy', cy);

      tooltip.hidden = false;
      tooltip.innerHTML = `
        <div><strong>${d.toFixed(2)} km</strong></div>
        <div>${Math.round(e)} m</div>
        <div>${s.toFixed(1)} %</div>
      `;

      const rootRect = root.getBoundingClientRect();
      const tipRect = tooltip.getBoundingClientRect();
      const tipX = Math.min(Math.max(cx + rootRect.left - rootRect.x - tipRect.width / 2, 8), rootRect.width - tipRect.width - 8);
      const tipY = cy + rootRect.top - rootRect.y - tipRect.height - 12;
      tooltip.style.left = `${tipX}px`;
      tooltip.style.top = `${Math.max(tipY, 8)}px`;
    }

    function hideTooltip() {
      tooltip.hidden = true;
      hoverLine.style.display = 'none';
      hoverDot.style.display = 'none';
    }

    svg.addEventListener('pointermove', updateTooltip);
    svg.addEventListener('pointerleave', hideTooltip);
    hideTooltip();
  };

  return { html, afterRender };
}

function chooseNiceStep(range, targetCount = 5) {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const raw = range / Math.max(1, targetCount);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / pow;
  let step;
  if (norm <= 1.5) step = 1;
  else if (norm <= 2.5) step = 2;
  else if (norm <= 4) step = 2.5;
  else if (norm <= 7.5) step = 5;
  else step = 10;
  return step * pow;
}

function makeTicks(min, max, step) {
  if (!Number.isFinite(step) || step <= 0) return [min, max];
  const out = [];
  for (let v = min; v <= max + 1e-6; v += step) out.push(Number(v.toFixed(6)));
  if (out[out.length - 1] !== max) out.push(max);
  return out;
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

  const legLabel = t('table.headers.leg');
  const accumulatedLabel = t('table.headers.accumulated');
  const timeLabel = t('table.headers.time');

  const headerRow = [
    t('table.headers.index'),
    t('table.headers.name'),
    t('table.headers.critical'),
    `${legLabel} – ${t('table.headers.legDistance')}`,
    `${legLabel} – ${t('table.headers.legAscent')}`,
    `${legLabel} – ${t('table.headers.legDescent')}`,
    `${accumulatedLabel} – ${t('table.headers.accDistance')}`,
    `${accumulatedLabel} – ${t('table.headers.accAscent')}`,
    `${accumulatedLabel} – ${t('table.headers.accDescent')}`,
    `${timeLabel} – ${t('table.headers.timeBase')}`,
    `${timeLabel} – ${t('table.headers.timeStops')}`,
    `${timeLabel} – ${t('table.headers.timeCond')}`,
    `${timeLabel} – ${t('table.headers.timeTotal')}`,
    `${timeLabel} – ${t('table.headers.timeAccumulated')}`,
    `${timeLabel} – ${t('table.headers.timeRemaining')}`,
    t('table.headers.observations'),
  ];

  const rows = [headerRow];
  const columnCount = headerRow.length;
  const criticalYesLabel = t('table.labels.yes');

  table.querySelectorAll('tbody tr').forEach(tr => {
    const cells = [...tr.children].map(td => {
      if (td.classList.contains('critical-cell')) {
        const checkbox = td.querySelector('input[type="checkbox"]');
        return checkbox && checkbox.checked ? criticalYesLabel : '';
      }
      const sel = td.querySelector('select');
      if (sel) {
        const opt = sel.options[sel.selectedIndex];
        return (opt ? opt.text : sel.value || '');
      }
      const span = td.querySelector('span');
      if (span) return span.textContent.trim();
      return td.textContent.replace(/\s+/g,' ').trim();
    });
    if (cells.length < columnCount) {
      while (cells.length < columnCount) cells.push('');
    } else if (cells.length > columnCount) {
      cells.length = columnCount;
    }
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
