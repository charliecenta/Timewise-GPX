// js/state.js
export const dom = {
  output:       document.getElementById('output'),
  roadbooksEl:  document.getElementById('roadbooks'),
  calcBtn:      document.getElementById('calculateBtn'),
  clearBtn:     document.getElementById('clearRoadbooksBtn'),
  saveBtn:      document.getElementById('savePlanBtn'),
  loadBtn:      document.getElementById('loadPlanBtn'),
  loadInput:    document.getElementById('loadPlanInput'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  printBtn:     document.getElementById('printBtn'),
  activitySel:  document.getElementById('activityType'),
  showAdvChk:   document.getElementById('showAdvanced'),
};

export const mapState = {
  map: null,
  tileLayer: null,
  polyline: null,
  markers: [], // Leaflet markers with __idx, __locked
};

export const track = {
  latLngs: [],        // [[lat, lon], ...] resampled
  breakIdx: [],       // segment starts
  cumDistKm: [],
  cumAscentM: [],
  cumDescentM: [],
  cumTimeH: [],
};

export const roadbooks = {
  idx: [],                           // indices into track.latLngs
  labels: new Map(),                 // pointIndex -> label
  legLabels: new Map(),              // "a|b" -> custom leg name
  legStopsMin: new Map(),            // "a|b" -> minutes
  legCondPct: new Map(),             // "a|b" -> percent
  legCritical: new Map(),            // "a|b" -> boolean
  legObservations: new Map(),        // "a|b" -> string
};

export const session = {
  lastTotalAdjustedH: 0,
  lastGpxText: '',
  lastGpxName: '',
};
