// js/utils.js

// ----- number helpers -----
export function toPosNum(v, d) { const n = parseFloat(v); return n > 0 ? n : d; }
export function toNonNegNum(v, d) { const n = parseFloat(v); return n >= 0 ? n : d; }
export function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
export function clampToOdd(val, minOdd, maxOdd) {
  val = clamp(val, minOdd, maxOdd);
  if (val % 2 === 0) val += (val >= maxOdd ? -1 : 1);
  return val;
}
export function sanitizeInt(str, def = 0) {
  const m = String(str ?? "").match(/\d+/);
  const n = m ? parseInt(m[0], 10) : def;
  return Number.isFinite(n) && n >= 0 ? n : def;
}

// ----- formatting -----
export function minutesToText(min) { return `${min} min`; }
export function fmtKm(km) { return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`; }
export function fmtHrs(hours) {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")} h`;
}
export function percentToText(p) {
  const n = Number.isFinite(p) ? Math.round(p) : 0;
  return `${n} %`;
}
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ----- parsing -----
export function parseCondPercent(str) {
  if (!str) return 0;
  // Accept "-10", "-10%", "+15", "15%" etc.
  const m = String(str).trim().match(/^([+-]?\d{1,4})\s*%?$/);
  const raw = m ? parseInt(m[1], 10) : 0;
  // Clamp to sensible bounds so we never get pathological totals
  const MIN_COND_PCT = -90, MAX_COND_PCT = 300;
  return Math.max(MIN_COND_PCT, Math.min(MAX_COND_PCT, raw));
}

// ----- geo -----
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
