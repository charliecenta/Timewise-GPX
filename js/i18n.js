const LANGUAGE_STORAGE_KEY = 'timewise-lang';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'ca', label: 'Català' },
];

const translations = {
  en: {
    top: {
      author: 'Made with ☕️ by Charlie Centa',
      languageLabel: 'Language',
    },
    buttons: {
      save: 'Save',
      load: 'Load',
      processGpx: 'Process GPX',
      clearRoadbooks: 'Clear roadbooks',
      print: 'Print',
      exportCsv: 'Export CSV',
      changeFile: 'Change File',
      selectFile: 'Select File',
      themeToggle: 'Toggle theme',
      editor: {
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
      },
    },
    gpx: {
      title: 'GPX Upload',
      dropzoneLabel: 'Upload GPX file',
      dropzoneHeading: 'Upload GPX file',
      dropHint: 'Drag & drop a GPX file here, or',
      ready: '<span class="ok">Ready:</span> {{name}} · {{size}}',
      error: '<span class="err">Error:</span> {{message}}',
      errors: {
        noFile: 'Please upload a GPX file.',
        dropWrongType: 'Please drop a .gpx file',
        selectWrongType: 'Selected file is not a .gpx',
        noSegments: 'No track segments found in GPX.',
      },
    },
    settings: {
      title: 'Settings',
      activity: {
        label: 'Activity',
        hike: 'Hiking / trail',
        mtb: 'Mountain biking',
        road: 'Road cycling',
      },
      flatSpeed: 'Flat speed (km/h)',
      verticalSpeed: 'Vertical speed (m/h)',
      downhillFactor: 'Downhill factor',
      downhillTip: 'Multiplicative factor for downhill segments. 0.66 means downhill takes two-thirds the time of flat/uphill for the same segment. Higher than 1.0 makes downhill slower (technical terrain).',
      resample: 'Resample (m)',
      resampleTip: 'Create evenly spaced points along the track. Smaller values (e.g., 1–3 m) capture curves better but use more points. Larger values run faster with less detail.',
      smooth: 'Smooth window (m)',
      smoothTip: 'Median filter size in metres used to remove elevation spikes. Small windows keep detail; larger windows are smoother but can flatten short features.',
      deadband: 'Elevation deadband (m)',
      deadbandTip: 'Ignore elevation wiggles smaller than this threshold when computing ascent/descent (reduces GPS jitter). Typical: 1–3 m.',
      showAdvanced: 'Show advanced configuration',
      importRoadbooks: 'Import roadbooks from GPX',
    },
    map: {
      title: 'Map',
      summary: 'Summary',
      itinerary: 'Itinerary',
      start: 'Start',
      finish: 'Finish',
      autoPrefix: 'WP',
      waypointName: 'Waypoint name',
      confirmDelete: 'Are you sure you want to remove this waypoint?',
      editor: {
        heading: 'Waypoint name',
      },
    },
    summary: {
      distance: 'Distance',
      ascent: 'Ascent',
      descent: 'Descent',
      activityTime: 'Estimated Activity Time',
      totalTime: 'Estimated Total Time',
    },
    table: {
      headers: {
        index: '#',
        name: 'Name',
        critical: 'Critical',
        leg: 'Leg',
        accumulated: 'Accumulated (Σ)',
        time: 'Time',
        observations: 'Observations',
        legDistance: 'd',
        legAscent: '↑',
        legDescent: '↓',
        accDistance: 'Σd',
        accAscent: 'Σ↑',
        accDescent: 'Σ↓',
        timeBase: 't',
        timeStops: 'Stops',
        timeCond: 'Cond',
        timeTotal: 'Total',
        timeAccumulated: 'Σt',
        timeRemaining: 'Rem',
      },
      tooltips: {
        editName: 'Click to edit name',
        markCritical: 'Mark leg as critical',
        stops: 'Integer minutes',
        conditions: 'Integer percent',
        observations: 'Add notes or comments',
      },
      csv: {
        noTable: 'No table to export.',
        criticalYes: 'Yes',
      },
    },
    io: {
      savedPlanMissing: 'This saved plan has no embedded GPX. Please process a GPX first, then load the plan.',
      loadedGpx: 'Loaded a GPX file. (Tip: use Save to export a resumable plan JSON.)',
      parseFailed: 'Could not parse the plan JSON. Make sure you selected a file saved by this app.',
      missingEmbeddedGpx: 'This saved plan doesn’t contain embedded GPX. Process the original GPX once, then load the plan again.',
      loadFailed: 'Could not load the file.\n\n{{message}}',
      noTable: 'No table to export.',
    },
    labels: {
      languageSelect: 'Language',
    },
  },
  es: {
    top: {
      author: 'Hecho con ☕️ por Charlie Centa',
      languageLabel: 'Idioma',
    },
    buttons: {
      save: 'Guardar',
      load: 'Cargar',
      processGpx: 'Procesar GPX',
      clearRoadbooks: 'Limpiar roadbooks',
      print: 'Imprimir',
      exportCsv: 'Exportar CSV',
      changeFile: 'Cambiar archivo',
      selectFile: 'Seleccionar archivo',
      themeToggle: 'Cambiar tema',
      editor: {
        save: 'Guardar',
        cancel: 'Cancelar',
        delete: 'Eliminar',
      },
    },
    gpx: {
      title: 'Subida de GPX',
      dropzoneLabel: 'Subir archivo GPX',
      dropzoneHeading: 'Subir archivo GPX',
      dropHint: 'Arrastra y suelta un archivo GPX aquí, o',
      ready: '<span class="ok">Listo:</span> {{name}} · {{size}}',
      error: '<span class="err">Error:</span> {{message}}',
      errors: {
        noFile: 'Por favor, sube un archivo GPX.',
        dropWrongType: 'Por favor, suelta un archivo .gpx',
        selectWrongType: 'El archivo seleccionado no es un .gpx',
        noSegments: 'No se encontraron segmentos de ruta en el GPX.',
      },
    },
    settings: {
      title: 'Configuración',
      activity: {
        label: 'Actividad',
        hike: 'Senderismo / trail',
        mtb: 'Ciclismo de montaña',
        road: 'Ciclismo de carretera',
      },
      flatSpeed: 'Velocidad en llano (km/h)',
      verticalSpeed: 'Velocidad vertical (m/h)',
      downhillFactor: 'Factor de bajada',
      downhillTip: 'Factor multiplicador para los tramos de bajada. 0,66 significa que la bajada tarda dos tercios del tiempo del llano/subida para el mismo tramo. Valores mayores de 1,0 hacen la bajada más lenta (terreno técnico).',
      resample: 'Re-muestrear (m)',
      resampleTip: 'Crea puntos igualmente espaciados a lo largo del track. Valores pequeños (p. ej., 1–3 m) capturan mejor las curvas pero usan más puntos. Valores grandes son más rápidos con menos detalle.',
      smooth: 'Ventana de suavizado (m)',
      smoothTip: 'Tamaño del filtro de mediana en metros usado para eliminar picos de elevación. Ventanas pequeñas mantienen el detalle; ventanas grandes son más suaves pero pueden aplanar elementos cortos.',
      deadband: 'Zona muerta de elevación (m)',
      deadbandTip: 'Ignora pequeñas oscilaciones de elevación por debajo de este umbral al calcular ascenso/descenso (reduce el ruido del GPS). Típico: 1–3 m.',
      showAdvanced: 'Mostrar configuración avanzada',
      importRoadbooks: 'Importar roadbooks desde el GPX',
    },
    map: {
      title: 'Mapa',
      summary: 'Resumen',
      itinerary: 'Itinerario',
      start: 'Inicio',
      finish: 'Final',
      autoPrefix: 'WP',
      waypointName: 'Nombre del punto',
      confirmDelete: '¿Seguro que quieres eliminar este punto?',
      editor: {
        heading: 'Nombre del punto',
      },
    },
    summary: {
      distance: 'Distancia',
      ascent: 'Ascenso',
      descent: 'Descenso',
      activityTime: 'Tiempo de actividad estimado',
      totalTime: 'Tiempo total estimado',
    },
    table: {
      headers: {
        index: '#',
        name: 'Nombre',
        critical: 'Crítico',
        leg: 'Tramo',
        accumulated: 'Acumulado (Σ)',
        time: 'Tiempo',
        observations: 'Observaciones',
        legDistance: 'd',
        legAscent: '↑',
        legDescent: '↓',
        accDistance: 'Σd',
        accAscent: 'Σ↑',
        accDescent: 'Σ↓',
        timeBase: 't',
        timeStops: 'Paradas',
        timeCond: 'Cond',
        timeTotal: 'Total',
        timeAccumulated: 'Σt',
        timeRemaining: 'Rest',
      },
      tooltips: {
        editName: 'Haz clic para editar el nombre',
        markCritical: 'Marcar tramo como crítico',
        stops: 'Minutos enteros',
        conditions: 'Porcentaje entero',
        observations: 'Añade notas o comentarios',
      },
      csv: {
        noTable: 'No hay tabla para exportar.',
        criticalYes: 'Sí',
      },
    },
    io: {
      savedPlanMissing: 'Este plan guardado no tiene un GPX incrustado. Procesa primero un GPX y luego carga el plan.',
      loadedGpx: 'Se ha cargado un archivo GPX. (Consejo: usa Guardar para exportar un plan reanudable en JSON).',
      parseFailed: 'No se pudo analizar el JSON del plan. Asegúrate de seleccionar un archivo guardado por esta aplicación.',
      missingEmbeddedGpx: 'Este plan guardado no contiene GPX incrustado. Procesa el GPX original una vez y vuelve a cargar el plan.',
      loadFailed: 'No se pudo cargar el archivo.\n\n{{message}}',
      noTable: 'No hay tabla para exportar.',
    },
    labels: {
      languageSelect: 'Idioma',
    },
  },
  ca: {
    top: {
      author: 'Fet amb ☕️ per Charlie Centa',
      languageLabel: 'Idioma',
    },
    buttons: {
      save: 'Desa',
      load: 'Carrega',
      processGpx: 'Processa GPX',
      clearRoadbooks: 'Neteja els roadbooks',
      print: 'Imprimeix',
      exportCsv: 'Exporta CSV',
      changeFile: 'Canvia el fitxer',
      selectFile: 'Selecciona el fitxer',
      themeToggle: 'Canvia el tema',
      editor: {
        save: 'Desa',
        cancel: 'Cancel·la',
        delete: 'Suprimeix',
      },
    },
    gpx: {
      title: 'Pujada de GPX',
      dropzoneLabel: 'Puja un fitxer GPX',
      dropzoneHeading: 'Puja un fitxer GPX',
      dropHint: 'Arrossega i deixa anar un fitxer GPX aquí, o',
      ready: '<span class="ok">Preparat:</span> {{name}} · {{size}}',
      error: '<span class="err">Error:</span> {{message}}',
      errors: {
        noFile: 'Si us plau, puja un fitxer GPX.',
        dropWrongType: 'Si us plau, deixa anar un fitxer .gpx',
        selectWrongType: 'El fitxer seleccionat no és un .gpx',
        noSegments: 'No s’han trobat trams de la ruta al GPX.',
      },
    },
    settings: {
      title: 'Configuració',
      activity: {
        label: 'Activitat',
        hike: 'Senderisme / trail',
        mtb: 'BTT',
        road: 'Ciclisme de carretera',
      },
      flatSpeed: 'Velocitat en pla (km/h)',
      verticalSpeed: 'Velocitat vertical (m/h)',
      downhillFactor: 'Factor de baixada',
      downhillTip: 'Factor multiplicador per als trams de baixada. 0,66 vol dir que la baixada tarda dos terços del temps del tram pla/pujada. Valors superiors a 1,0 fan la baixada més lenta (terreny tècnic).',
      resample: 'Re-mostreig (m)',
      resampleTip: 'Crea punts igualment espaiats al llarg del track. Valors petits (p. ex. 1–3 m) capten millor les corbes però utilitzen més punts. Valors grans són més ràpids amb menys detall.',
      smooth: 'Finestra de suavitzat (m)',
      smoothTip: 'Mida del filtre de mediana en metres utilitzat per eliminar pics d’elevació. Finestres petites mantenen el detall; les grans són més suaus però poden aplanar elements curts.',
      deadband: 'Zona morta d’elevació (m)',
      deadbandTip: 'Ignora oscil·lacions d’elevació per sota d’aquest llindar en calcular l’ascens/descens (redueix el soroll del GPS). Habitual: 1–3 m.',
      showAdvanced: 'Mostra la configuració avançada',
      importRoadbooks: 'Importa roadbooks del GPX',
    },
    map: {
      title: 'Mapa',
      summary: 'Resum',
      itinerary: 'Itinerari',
      start: 'Inici',
      finish: 'Final',
      autoPrefix: 'WP',
      waypointName: 'Nom del punt',
      confirmDelete: 'Segur que vols eliminar aquest punt?',
      editor: {
        heading: 'Nom del punt',
      },
    },
    summary: {
      distance: 'Distància',
      ascent: 'Desnivell positiu',
      descent: 'Desnivell negatiu',
      activityTime: 'Temps d’activitat estimat',
      totalTime: 'Temps total estimat',
    },
    table: {
      headers: {
        index: '#',
        name: 'Nom',
        critical: 'Crític',
        leg: 'Tram',
        accumulated: 'Acumulat (Σ)',
        time: 'Temps',
        observations: 'Observacions',
        legDistance: 'd',
        legAscent: '↑',
        legDescent: '↓',
        accDistance: 'Σd',
        accAscent: 'Σ↑',
        accDescent: 'Σ↓',
        timeBase: 't',
        timeStops: 'Parades',
        timeCond: 'Cond',
        timeTotal: 'Total',
        timeAccumulated: 'Σt',
        timeRemaining: 'Rest',
      },
      tooltips: {
        editName: 'Fes clic per editar el nom',
        markCritical: 'Marca el tram com a crític',
        stops: 'Minuts enters',
        conditions: 'Percentatge enter',
        observations: 'Afegeix notes o comentaris',
      },
      csv: {
        noTable: 'No hi ha cap taula per exportar.',
        criticalYes: 'Sí',
      },
    },
    io: {
      savedPlanMissing: 'Aquest pla desat no té cap GPX incrustat. Processa un GPX primer i després carrega el pla.',
      loadedGpx: 'S’ha carregat un fitxer GPX. (Consell: utilitza Desa per exportar un pla en JSON que puguis reprendre).',
      parseFailed: 'No s’ha pogut analitzar el JSON del pla. Assegura’t de seleccionar un fitxer desat per aquesta aplicació.',
      missingEmbeddedGpx: 'Aquest pla desat no conté cap GPX incrustat. Processa un cop el GPX original i torna a carregar el pla.',
      loadFailed: 'No s’ha pogut carregar el fitxer.\n\n{{message}}',
      noTable: 'No hi ha cap taula per exportar.',
    },
    labels: {
      languageSelect: 'Idioma',
    },
  },
};

const listeners = new Set();
let currentLang = 'en';

function resolve(obj, path) {
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

function format(template, vars = {}) {
  return String(template).replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match;
  });
}

function applyToElement(el, langData) {
  const key = el.dataset.i18n;
  if (key) {
    const value = resolve(langData, key) ?? resolve(translations.en, key) ?? key;
    if (value != null) {
      if (el.dataset.i18nHtml === 'true') {
        el.innerHTML = value;
      } else {
        el.textContent = value;
      }
    }
  }

  const attrMap = el.dataset.i18nAttrs;
  if (attrMap) {
    attrMap.split(';').forEach(pair => {
      if (!pair) return;
      const [attr, attrKey] = pair.split(':');
      if (!attr || !attrKey) return;
      const value = resolve(langData, attrKey) ?? resolve(translations.en, attrKey);
      if (value != null) {
        if (attr === 'html') {
          el.innerHTML = value;
        } else {
          el.setAttribute(attr, value);
        }
      }
    });
  }
}

function translateDocument() {
  const langData = translations[currentLang] ?? translations.en;
  document.querySelectorAll('[data-i18n]').forEach(el => applyToElement(el, langData));
}

function setLanguage(code, { skipStorage = false } = {}) {
  if (!translations[code]) code = 'en';
  if (currentLang === code) {
    translateDocument();
    return currentLang;
  }
  currentLang = code;
  if (!skipStorage) {
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLang); } catch {}
  }
  document.documentElement.lang = currentLang;
  translateDocument();
  listeners.forEach(fn => fn(currentLang));
  return currentLang;
}

export function t(key, vars = {}, fallback) {
  const langData = translations[currentLang] ?? translations.en;
  let template = resolve(langData, key);
  if (template == null) template = resolve(translations.en, key);
  if (template == null) template = fallback ?? key;
  return format(template, vars);
}

export function addLanguageChangeListener(fn) {
  if (typeof fn === 'function') listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initI18n({ selectorEl, defaultLang = 'en' } = {}) {
  const stored = (() => {
    try { return localStorage.getItem(LANGUAGE_STORAGE_KEY); } catch { return null; }
  })();

  const initial = stored && translations[stored] ? stored : (translations[defaultLang] ? defaultLang : 'en');

  if (selectorEl) {
    selectorEl.innerHTML = '';
    SUPPORTED_LANGUAGES.forEach(lang => {
      const opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = lang.label;
      selectorEl.appendChild(opt);
    });
    selectorEl.value = initial;
    selectorEl.addEventListener('change', () => {
      setLanguage(selectorEl.value);
    });
  }

  setLanguage(initial, { skipStorage: true });
  return currentLang;
}

export function getCurrentLanguage() {
  return currentLang;
}

export function translateOnLoad() {
  translateDocument();
}

export { translations };
