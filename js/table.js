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
  elevationEl: null,

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
    if (API.elevationEl) API.elevationEl.innerHTML = "";
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

  API.outputEl.innerHTML = `
    <ul>
      <li><strong>${t('summary.distance')}:</strong> ${fmtKm(totals.distKm)}</li>
      <li><strong>${t('summary.ascent')}:</strong> ${Math.round(totals.ascM)} m</li>
      <li><strong>${t('summary.descent')}:</strong> ${Math.round(totals.desM)} m</li>
      <li><strong>${t('summary.activityTime')}:</strong> ${fmtHrs(roll.activityWithCondH)}</li>
      <li><strong>${t('summary.totalTime')}:</strong> ${fmtHrs(roll.totalH)}</li>
    </ul>
    ${formulaHtml}
  `;

  const profileBlock = renderElevationProfile({
    distKm: cumDistKm,
    elevM: API.getTrackElev?.() ?? [],
    title: t('summary.elevationProfile'),
    roadbooks: API.roadbookIdx
      .map(idx => ({
        idx,
        distKm: cumDistKm[idx],
        elevM: (API.getTrackElev?.() ?? [])[idx],
        label: API.getWaypointName?.(idx) ?? `WP ${idx}`
      }))
      .filter(rb => Number.isFinite(rb.distKm) && Number.isFinite(rb.elevM)),
  });

  if (API.elevationEl) {
    API.elevationEl.innerHTML = profileBlock?.html ?? '';
    profileBlock?.bind?.(API.elevationEl);
  }
}

let elevationProfileId = 0;

function renderElevationProfile({ distKm = [], elevM = [], title = '', roadbooks = [] }) {
  const pairs = distKm.map((d, i) => ({ d, e: elevM[i] }))
    .filter(p => Number.isFinite(p.d) && Number.isFinite(p.e));

  if (pairs.length < 2) return null;

  const totalDist = pairs[pairs.length - 1].d;
  if (!Number.isFinite(totalDist) || totalDist <= 0) return null;

  const minElev = Math.min(...pairs.map(p => p.e));
  const maxElev = Math.max(...pairs.map(p => p.e));
  const elevRange = Math.max(1, maxElev - minElev);

  const width = 720;
  const baseHeight = 260;
  const padX = 46;
  const padBottom = 28;

  const validRoadbooks = roadbooks
    .filter(rb => Number.isFinite(rb.distKm) && Number.isFinite(rb.elevM));

  const height = baseHeight;
  const padTop = 28;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;
  const baseY = padTop + innerH;

  const chooseStep = (range, targetTicks = 6) => {
    if (range <= 0 || !Number.isFinite(range)) return 1;
    const rough = range / targetTicks;
    const pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / pow10;
    let step;
    if (norm >= 7.5) step = 10;
    else if (norm >= 5) step = 5;
    else if (norm >= 3) step = 2;
    else if (norm >= 1.5) step = 1;
    else step = 0.5;
    return step * pow10;
  };

  const toX = (d) => padX + (d / totalDist) * innerW;
  const toY = (e) => padTop + (1 - ((e - minElev) / elevRange)) * innerH;

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

  const distStepBase = chooseStep(totalDist, 5);
  const elevStep = chooseStep(elevRange, 5);
  const minLabelSpacing = 70;
  const maxDistTicks = Math.max(3, Math.floor(innerW / minLabelSpacing));
  const makeTicks = (step) => {
    const ticks = [];
    for (let d = 0; d <= totalDist + step * 0.25; d += step) {
      ticks.push(Math.min(totalDist, d));
    }
    return ticks;
  };
  let distStep = distStepBase;
  let distTicks = makeTicks(distStep);
  while (distTicks.length > maxDistTicks) {
    distStep *= 2;
    distTicks = makeTicks(distStep);
  }
  const elevTicks = [];
  const elevStart = Math.floor(minElev / elevStep) * elevStep;
  for (let e = elevStart; e <= maxElev + elevStep * 0.5; e += elevStep) {
    elevTicks.push(e);
  }

  const profileId = `elev-${++elevationProfileId}`;
  const gradId = `elev-fill-${profileId}`;
  const cursorStartX = toX(first.d).toFixed(1);
  const cursorStartY = toY(first.e).toFixed(1);

  const rbMarkers = validRoadbooks.map(rb => ({
    x: toX(rb.distKm),
    y: toY(rb.elevM),
    label: rb.label,
  }));

  const html = `
    <div class="summary-elevation" aria-label="${escapeHtml(title)}">
      <div class="summary-elevation__header">
        <span class="summary-elevation__title">${escapeHtml(title)}</span>
        <span class="summary-elevation__meta">${escapeHtml(kmLabel)} · ${escapeHtml(elevLabel)}</span>
      </div>
      <div class="summary-elevation__plot-wrap">
        <svg class="summary-elevation__plot" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}" data-elev-id="${profileId}">
          <defs>
            <linearGradient id="${gradId}" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.32" />
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.05" />
            </linearGradient>
          </defs>
          <rect x="${padX}" y="${padTop}" width="${innerW}" height="${innerH}" fill="var(--map-bg)" rx="8" ry="8" />
          <g class="summary-elevation__grid" stroke="var(--card-border)" stroke-width="1">
            ${distTicks.map(d => {
              const x = toX(d).toFixed(1);
              return `<line x1="${x}" y1="${padTop}" x2="${x}" y2="${baseY}" />`;
            }).join('')}
            ${elevTicks.map(e => {
              const y = toY(e).toFixed(1);
              return `<line x1="${padX}" y1="${y}" x2="${padX + innerW}" y2="${y}" />`;
            }).join('')}
          </g>
          <path d="${areaD}" fill="url(#${gradId})" stroke="none" />
          <path d="${lineD}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          <g class="summary-elevation__axes" fill="var(--muted)" font-size="10" font-weight="600">
            ${distTicks.map(d => {
              const x = toX(d).toFixed(1);
              return `<text x="${x}" y="${baseY + 18}" text-anchor="${d === 0 ? 'start' : (d >= totalDist ? 'end' : 'middle')}" aria-hidden="true">${d.toFixed( d < 10 ? 1 : 0)} km</text>`;
            }).join('')}
            ${elevTicks.map(e => {
              const y = toY(e).toFixed(1);
              return `<text x="${padX - 8}" y="${y + 4}" text-anchor="end" aria-hidden="true">${Math.round(e)} m</text>`;
            }).join('')}
          </g>
          <g class="summary-elevation__roadbooks" fill="var(--accent)" font-size="9" font-weight="600">
            ${rbMarkers.map(rb => {
              const y = Math.min(baseY - 6, Math.max(padTop + 0, rb.y));
              const label = escapeHtml(rb.label || '');
              return `
                <g class="summary-elevation__waypoint" data-label="${label}" data-x="${rb.x.toFixed(1)}" data-y="${y.toFixed(1)}">
                  <rect class="summary-elevation__waypoint-hit" x="${(rb.x - 8).toFixed(1)}" y="${padTop}" width="16" height="${(baseY - padTop).toFixed(1)}" />
                  <line x1="${rb.x.toFixed(1)}" y1="${padTop}" x2="${rb.x.toFixed(1)}" y2="${baseY}" stroke="var(--accent)" stroke-width="1" stroke-dasharray="4 3" opacity="0.4" />
                  <circle cx="${rb.x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="var(--card-bg)" stroke="var(--accent)" stroke-width="2" />
                </g>`;
            }).join('')}
          </g>
          <circle class="summary-elevation__cursor" data-elev-cursor="${profileId}" cx="${cursorStartX}" cy="${cursorStartY}" r="5" fill="var(--accent)" stroke="var(--card-bg)" stroke-width="2" opacity="0" />
        </svg>
        <div class="summary-elevation__tooltip" data-elev-tooltip="${profileId}" role="status" aria-live="polite"></div>
        <div class="summary-elevation__tooltip summary-elevation__tooltip--waypoint" data-elev-waypoint-tooltip="${profileId}" role="status" aria-live="polite"></div>
      </div>
    </div>
  `;

  const bind = (rootEl) => {
    const svg = (rootEl || document).querySelector(`svg[data-elev-id="${profileId}"]`);
    const tip = (rootEl || document).querySelector(`.summary-elevation__tooltip[data-elev-tooltip="${profileId}"]`);
    const waypointTip = (rootEl || document).querySelector(`.summary-elevation__tooltip[data-elev-waypoint-tooltip="${profileId}"]`);
    const cursor = (rootEl || document).querySelector(`.summary-elevation__cursor[data-elev-cursor="${profileId}"]`);
    if (!svg || !tip || !cursor) return;

    const bbox = { left: padX, right: padX + innerW };
    const distances = pairs.map(p => p.d);

    const lookupIndex = (mouseX) => {
      const clampX = Math.max(bbox.left, Math.min(bbox.right, mouseX));
      const rel = (clampX - padX) / innerW;
      const targetD = rel * totalDist;
      let lo = 0, hi = distances.length - 1;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (distances[mid] < targetD) lo = mid + 1; else hi = mid;
      }
      const idx = lo;
      if (idx <= 0) return 0;
      const prev = distances[idx - 1];
      return (targetD - prev) < (distances[idx] - targetD) ? idx - 1 : idx;
    };

    const formatKm = (v) => `${v.toFixed(v < 10 ? 2 : 1)} km`;
    const formatSlope = (i) => {
      if (i <= 0) i = 1;
      const a = pairs[i - 1];
      const b = pairs[i];
      const dM = Math.max(1e-6, (b.d - a.d) * 1000);
      const slopePct = ((b.e - a.e) / dM) * 100;
      return `${slopePct.toFixed(1)}%`;
    };

    const positionTip = (tipEl, x, y, opts = {}) => {
      if (!tipEl) return;
      const wrapRect = svg.parentElement?.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();
      const scaleX = svgRect.width / width;
      const scaleY = svgRect.height / height;
      const offsetX = wrapRect ? (svgRect.left - wrapRect.left) : 0;
      const offsetY = wrapRect ? (svgRect.top - wrapRect.top) : 0;
      const tipHalfW = (tipEl.offsetWidth || 0) / 2;
      const tipH = tipEl.offsetHeight || 0;
      const relX = offsetX + (x * scaleX);
      const relY = offsetY + (y * scaleY);
      const maxX = (wrapRect?.width ?? svgRect.width) - tipHalfW - 4;
      const minX = tipHalfW + 4;
      const clampedX = Math.max(minX, Math.min(maxX, relX));
      const containerH = wrapRect?.height ?? svgRect.height;
      const anchorY = opts.placement === 'below'
        ? Math.min(containerH - tipH - 4, relY + 10)
        : Math.max(0, relY - tipH - 10);
      tipEl.style.left = `${clampedX}px`;
      tipEl.style.top = `${anchorY}px`;
    };

    const onMove = (evt) => {
      const pt = svg.createSVGPoint();
      pt.x = evt.clientX; pt.y = evt.clientY;
      const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
      const idx = lookupIndex(loc.x);
      const p = pairs[idx];
      const x = toX(p.d);
      const y = toY(p.e);
      tip.textContent = `${formatKm(p.d)} · ${Math.round(p.e)} m · ${formatSlope(idx)} slope`;
      tip.style.display = 'block';
      positionTip(tip, x, y);
      cursor.setAttribute('cx', x.toFixed(2));
      cursor.setAttribute('cy', y.toFixed(2));
      cursor.setAttribute('opacity', '1');
    };

    const onLeave = () => {
      tip.style.display = 'none';
      cursor.setAttribute('opacity', '0');
      if (waypointTip) waypointTip.style.display = 'none';
    };

    const onWaypointEnter = (evt) => {
      const target = evt.currentTarget;
      if (!waypointTip || !(target instanceof SVGGraphicsElement)) return;
      const label = target.getAttribute('data-label') || '';
      if (!label) return;
      const x = parseFloat(target.getAttribute('data-x') || '0');
      const y = parseFloat(target.getAttribute('data-y') || '0');
      waypointTip.textContent = label;
      waypointTip.style.display = 'block';
      positionTip(waypointTip, x, y, { placement: 'below' });
    };

    const onWaypointLeave = () => {
      if (waypointTip) waypointTip.style.display = 'none';
    };

    svg.addEventListener('mousemove', onMove);
    svg.addEventListener('mouseleave', onLeave);
    svg.querySelectorAll('.summary-elevation__waypoint').forEach(node => {
      node.addEventListener('mouseenter', onWaypointEnter);
      node.addEventListener('mouseleave', onWaypointLeave);
    });
  };

  return { html, bind };
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
