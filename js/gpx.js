// js/gpx.js
// GPX parsing utilities: segments (trkseg/trkpt or rtept) and waypoints/roadbooks (wpt/rtept/named trkpt)

function parseXml(text) {
  const parser = new DOMParser();
  // Let the browser sniff; some iOS files come as text/xml
  const xml = parser.parseFromString(String(text || ""), "application/xml");
  // Detect parser errors
  if (xml.querySelector("parsererror")) return null;
  return xml;
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function getFirstText(elem, tag) {
  const n = elem.getElementsByTagName(tag)[0];
  return n ? String(n.textContent || "").trim() : "";
}

/**
 * parseGPXToSegments(text) → Array< Array<{lat,lon,ele|null}> >
 * - Returns an array of track segments.
 * - Primary source: <trkseg><trkpt ...><ele>...</ele></trkpt></trkseg>
 * - Fallback: a single-segment route from <rtept> if no <trkseg> found.
 */
export function parseGPXToSegments(gpxText) {
  const xml = parseXml(gpxText);
  if (!xml) return [];

  const segNodes = Array.from(xml.getElementsByTagName("trkseg"));
  let segments = [];

  if (segNodes.length) {
    segments = segNodes.map(seg => {
      const pts = Array.from(seg.getElementsByTagName("trkpt"))
        .map(pt => {
          const lat = num(pt.getAttribute("lat"));
          const lon = num(pt.getAttribute("lon"));
          const ele = num(getFirstText(pt, "ele"));
          if (lat == null || lon == null) return null;
          return { lat, lon, ele };
        })
        .filter(Boolean);
      return pts;
    }).filter(arr => arr.length >= 2);
  } else {
    // Fallback: treat <rtept> as a single segment if no trkseg
    const rtepts = Array.from(xml.getElementsByTagName("rtept"))
      .map(pt => {
        const lat = num(pt.getAttribute("lat"));
        const lon = num(pt.getAttribute("lon"));
        const ele = num(getFirstText(pt, "ele"));
        if (lat == null || lon == null) return null;
        return { lat, lon, ele };
      })
      .filter(Boolean);
    if (rtepts.length >= 2) segments = [rtepts];
  }

  return segments;
}

/**
 * parseGPXRoadbooks(text) → Array<{lat,lon,name}>
 * - Collects named points users care about:
 *   • <wpt> (standard waypoints)
 *   • <rtept> (route points—often named in planning tools)
 *   • <trkpt> only if it has a <name>/<cmt>/<sym> (some tools put names on track points)
 */
export function parseGPXRoadbooks(gpxText) {
  const xml = parseXml(gpxText);
  if (!xml) return [];

  const out = [];

  // <wpt>
  for (const w of Array.from(xml.getElementsByTagName("wpt"))) {
    const lat = num(w.getAttribute("lat"));
    const lon = num(w.getAttribute("lon"));
    if (lat == null || lon == null) continue;
    const name = getFirstText(w, "name") || getFirstText(w, "cmt") || getFirstText(w, "sym");
    out.push({ lat, lon, name });
  }

  // <rtept>
  for (const r of Array.from(xml.getElementsByTagName("rtept"))) {
    const lat = num(r.getAttribute("lat"));
    const lon = num(r.getAttribute("lon"));
    if (lat == null || lon == null) continue;
    const name = getFirstText(r, "name") || getFirstText(r, "cmt") || getFirstText(r, "sym");
    out.push({ lat, lon, name });
  }

  // Named <trkpt> (some apps annotate track points)
  for (const t of Array.from(xml.getElementsByTagName("trkpt"))) {
    const name =
      getFirstText(t, "name") || getFirstText(t, "cmt") || getFirstText(t, "sym");
    if (!name) continue;
    const lat = num(t.getAttribute("lat"));
    const lon = num(t.getAttribute("lon"));
    if (lat == null || lon == null) continue;
    out.push({ lat, lon, name });
  }

  return out;
}
