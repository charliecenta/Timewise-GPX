// js/track.js
// Resampling, smoothing, deadband, time model, nearest point, and one-shot builder.

import { clamp, clampToOdd, haversineKm } from './utils.js';

/** Fill missing elevation by forward/backward pass. */
export function fillElevationOnPoints(points) {
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

/** Resample polyline by target spacing (metres), linear interp lat/lon/ele. */
export function resampleByDistance(points, spacingM) {
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
    const ele = (p0.ele != null && p1.ele != null)
      ? (p0.ele + a * (p1.ele - p0.ele))
      : (p0.ele != null ? p0.ele : p1.ele);

    out.push({ lat, lon, ele });
  }
  return out;
}

/** Median filter over an odd window (win). */
export function medianFilter(arr, win) {
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

/** Cumulative deadband on elevation to suppress tiny zig-zags. */
export function cumulativeDeadbandFilter(elev, deadband) {
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

/** Find nearest resampled index on track for a lat/lon. */
export function nearestIndexOnTrack([la, lo], latlngs) {
  let bestIdx = 0, bestD = Infinity;
  for (let i = 0; i < latlngs.length; i++) {
    const [lb, lob] = latlngs[i];
    const d = haversineKm(la, lo, lb, lob);
    if (d < bestD) { bestD = d; bestIdx = i; }
  }
  return bestIdx;
}

/**
 * Build full resampled track + cumulative arrays + totals from raw segments & settings.
 * Returns:
 *  {
 *    trackLatLngs, trackElevM, breakIdx,
 *    cumDistKm, cumAscentM, cumDescentM, cumTimeH,
 *    totals: { distKm, ascentM, descentM, timeHrs }
 *  }
 */
export function buildTrackFromSegments(segments, settings) {
  const {
    spacingM, smoothWinM, elevDeadbandM,
    speedFlatKmh, speedVertMh, downhillFactor,
    activity = 'hike'
  } = settings;

  let trackLatLngs = [];
  let trackElevM = [];
  const breakIdx = [];
  const cumDistKm = [0], cumAscentM = [0], cumDescentM = [0], cumTimeH = [0];

  let totalDistKm = 0, totalAscentM = 0, totalDescentM = 0, totalTimeHrs = 0;

  for (const pts of segments) {
    if (pts.length < 2) continue;

    const filled = fillElevationOnPoints(pts);
    const resampled = resampleByDistance(filled, spacingM);
    if (resampled.length < 2) continue;

    const winSamples = clampToOdd(Math.max(3, Math.round(smoothWinM / spacingM)), 3, 999);
    const elev = resampled.map(p => p.ele);
    const elevSmooth = medianFilter(elev, winSamples);
    const elevFiltered = cumulativeDeadbandFilter(elevSmooth, elevDeadbandM);

    // mark segment break
    breakIdx.push(trackLatLngs.length);

    // keep cum arrays aligned at breaks
    if (trackLatLngs.length > 0) {
      cumDistKm.push(cumDistKm[cumDistKm.length - 1]);
      cumAscentM.push(cumAscentM[cumAscentM.length - 1]);
      cumDescentM.push(cumDescentM[cumDescentM.length - 1]);
      cumTimeH.push(cumTimeH[cumTimeH.length - 1]);
    }

    const latlngs = resampled.map(p => [p.lat, p.lon]);
    trackLatLngs = trackLatLngs.concat(latlngs);
    trackElevM = trackElevM.concat(elevFiltered.map(v => Number.isFinite(v) ? v : 0));

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

      let segTimeH = activity === 'snowshoe'
        ? (h + v)
        : (Math.max(h, v) + 0.5 * Math.min(h, v));
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
  }

  return {
    trackLatLngs, trackElevM, breakIdx,
    cumDistKm, cumAscentM, cumDescentM, cumTimeH,
    totals: { distKm: totalDistKm, ascentM: totalAscentM, descentM: totalDescentM, timeHrs: totalTimeHrs }
  };
}
