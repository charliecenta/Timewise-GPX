const translations = {
  en: {
    topBar: {
      author: 'Made with ☕️ by Charlie Centa'
    },
    language: {
      label: 'Language'
    },
    buttons: {
      save: 'Save',
      load: 'Load',
      process: 'Process GPX',
      clearRoadbooks: 'Clear roadbooks',
      exportCsv: 'Export CSV',
      print: 'Print',
      themeToggle: 'Toggle theme',
      selectFile: 'Select File',
      changeFile: 'Change File'
    },
    sections: {
      gpxUpload: 'GPX Upload',
      settings: 'Settings',
      map: 'Map',
      summary: 'Summary',
      itinerary: 'Itinerary'
    },
    dropzone: {
      title: 'Upload GPX file',
      instructions: 'Drag & drop a GPX file here, or',
      ariaLabel: 'Upload GPX file',
      readyPrefix: 'Ready:',
      errorPrefix: 'Error:',
      readyStatus: '{{name}} · {{size}}'
    },
    settings: {
      activity: 'Activity',
      flatSpeed: 'Flat speed (km/h)',
      vertSpeed: 'Vertical speed (m/h)',
      downhillFactor: 'Downhill factor',
      resample: 'Resample (m)',
      smoothWindow: 'Smooth window (m)',
      elevDeadband: 'Elevation deadband (m)',
      advancedToggle: 'Show advanced configuration',
      importRoadbooks: 'Import roadbooks from GPX'
    },
    activity: {
      hike: 'Hiking / trail',
      mtb: 'Mountain biking',
      road: 'Road cycling'
    },
    help: {
      downhillLabel: 'Downhill factor info',
      downhillTip: 'Multiplicative factor for downhill segments. 0.66 means downhill takes two-thirds the time of flat/uphill for the same segment. Higher than 1.0 makes downhill slower (technical terrain).',
      resampleLabel: 'Resample info',
      resampleTip: 'Create evenly spaced points along the track. Smaller values (e.g., 1–3 m) capture curves better but use more points. Larger values run faster with less detail.',
      smoothLabel: 'Smooth window info',
      smoothTip: 'Median filter size in metres used to remove elevation spikes. Small windows keep detail; larger windows are smoother but can flatten short features.',
      deadbandLabel: 'Deadband info',
      deadbandTip: 'Ignore elevation wiggles smaller than this threshold when computing ascent/descent (reduces GPS jitter). Typical: 1–3 m.'
    },
    map: {
      ariaLabel: 'Route map',
      clear: 'Clear roadbooks',
      confirmRemoveWaypoint: 'Are you sure you want to remove this waypoint?',
      editorLabel: 'Waypoint name',
      editorSave: 'Save',
      editorCancel: 'Cancel',
      editorDelete: 'Delete'
    },
    labels: {
      start: 'Start',
      finish: 'Finish'
    },
    roadbooks: {
      print: 'Print',
      exportCsv: 'Export CSV'
    },
    table: {
      headers: {
        index: '#',
        name: 'Name',
        critical: 'Critical',
        leg: 'Leg',
        accumulated: 'Accumulated (Σ)',
        time: 'Time',
        observations: 'Observations'
      },
      subHeaders: {
        stops: 'Stops',
        cond: 'Cond',
        total: 'Total',
        remaining: 'Rem'
      },
      titles: {
        editName: 'Click to edit name',
        markCritical: 'Mark leg as critical',
        stops: 'Integer minutes',
        cond: 'Integer percent',
        observations: 'Add notes or comments'
      }
    },
    summary: {
      distance: 'Distance:',
      ascent: 'Ascent:',
      descent: 'Descent:',
      activityTime: 'Estimated Activity Time:',
      totalTime: 'Estimated Total Time:'
    },
    alerts: {
      uploadPrompt: 'Please upload a GPX file.',
      noSegments: 'No track segments found in GPX.',
      dropInvalid: 'Please drop a .gpx file',
      selectedInvalid: 'Selected file is not a .gpx',
      noTable: 'No table to export.',
      planNoEmbeddedGpx: 'This saved plan has no embedded GPX. Please process a GPX first, then load the plan.',
      planLoadedGpx: 'Loaded a GPX file. (Tip: use Save to export a resumable plan JSON.)',
      parseFailed: 'Could not parse the plan JSON. Make sure you selected a file saved by this app.',
      planMissingGpx: 'This saved plan doesn’t contain embedded GPX. Process the original GPX once, then load the plan again.',
      loadFailed: 'Could not load the file.\n\n{{message}}'
    }
  },
  es: {
    topBar: {
      author: 'Hecho con ☕️ por Charlie Centa'
    },
    language: {
      label: 'Idioma'
    },
    buttons: {
      save: 'Guardar',
      load: 'Cargar',
      process: 'Procesar GPX',
      clearRoadbooks: 'Limpiar roadbooks',
      exportCsv: 'Exportar CSV',
      print: 'Imprimir',
      themeToggle: 'Cambiar tema',
      selectFile: 'Seleccionar archivo',
      changeFile: 'Cambiar archivo'
    },
    sections: {
      gpxUpload: 'Carga GPX',
      settings: 'Configuración',
      map: 'Mapa',
      summary: 'Resumen',
      itinerary: 'Itinerario'
    },
    dropzone: {
      title: 'Subir archivo GPX',
      instructions: 'Arrastra y suelta un archivo GPX aquí, o',
      ariaLabel: 'Subir archivo GPX',
      readyPrefix: 'Listo:',
      errorPrefix: 'Error:',
      readyStatus: '{{name}} · {{size}}'
    },
    settings: {
      activity: 'Actividad',
      flatSpeed: 'Velocidad en llano (km/h)',
      vertSpeed: 'Velocidad vertical (m/h)',
      downhillFactor: 'Factor de bajada',
      resample: 'Re-muestreo (m)',
      smoothWindow: 'Ventana de suavizado (m)',
      elevDeadband: 'Banda muerta d
e altitud (m)',
      advancedToggle: 'Mostrar configuración avanzada',
      importRoadbooks: 'Importar roadbooks desde el GPX'
    },
    activity: {
      hike: 'Senderismo / trail',
      mtb: 'Ciclismo de montaña',
      road: 'Ciclismo de carretera'
    },
    help: {
      downhillLabel: 'Información del factor de bajada',
      downhillTip: 'Factor multiplicador para los tramos de bajada. 0,66 significa que la bajada tarda dos tercios del tiempo del llano/subida para el mismo tramo. Valores superiores a 1,0 hacen la bajada más lenta (terreno técnico).',
      resampleLabel: 'Información del re-muestreo',
      resampleTip: 'Crea puntos espaciados de manera uniforme a lo largo de la ruta. Valores pequeños (p. ej., 1–3 m) capturan mejor las curvas pero usan más puntos. Valores mayores son más rápidos con menos detalle.',
      smoothLabel: 'Información de la ventana de suavizado',
      smoothTip: 'Tamaño del filtro mediano en metros usado para eliminar picos de altitud. Ventanas pequeñas mantienen el detalle; ventanas grandes son más suaves pero pueden aplanar elementos cortos.',
      deadbandLabel: 'Información de la banda muerta',
      deadbandTip: 'Ignora oscilaciones de altitud menores que este umbral al calcular ascenso/descenso (reduce el ruido del GPS). Típico: 1–3 m.'
    },
    map: {
      ariaLabel: 'Mapa de la ruta',
      clear: 'Limpiar roadbooks',
      confirmRemoveWaypoint: '¿Seguro que quieres eliminar este waypoint?',
      editorLabel: 'Nombre del waypoint',
      editorSave: 'Guardar',
      editorCancel: 'Cancelar',
      editorDelete: 'Eliminar'
    },
    labels: {
      start: 'Inicio',
      finish: 'Final'
    },
    roadbooks: {
      print: 'Imprimir',
      exportCsv: 'Exportar CSV'
    },
    table: {
      headers: {
        index: '#',
        name: 'Nombre',
        critical: 'Crítico',
        leg: 'Tramo',
        accumulated: 'Acumulado (Σ)',
        time: 'Tiempo',
        observations: 'Observaciones'
      },
      subHeaders: {
        stops: 'Paradas',
        cond: 'Cond',
        total: 'Total',
        remaining: 'Rest'
      },
      titles: {
        editName: 'Haz clic para editar el nombre',
        markCritical: 'Marcar tramo como crítico',
        stops: 'Minutos enteros',
        cond: 'Porcentaje entero',
        observations: 'Añade notas o comentarios'
      }
    },
    summary: {
      distance: 'Distancia:',
      ascent: 'Ascenso:',
      descent: 'Descenso:',
      activityTime: 'Tiempo de actividad estimado:',
      totalTime: 'Tiempo total estimado:'
    },
    alerts: {
      uploadPrompt: 'Por favor sube un archivo GPX.',
      noSegments: 'No se encontraron segmentos de ruta en el GPX.',
      dropInvalid: 'Arrastra un archivo .gpx',
      selectedInvalid: 'El archivo seleccionado no es un .gpx',
      noTable: 'No hay tabla para exportar.',
      planNoEmbeddedGpx: 'Este plan guardado no tiene un GPX incrustado. Procesa un GPX primero y luego carga el plan.',
      planLoadedGpx: 'Se cargó un archivo GPX. (Consejo: usa Guardar para exportar un JSON reanudable.)',
      parseFailed: 'No se pudo analizar el JSON del plan. Asegúrate de seleccionar un archivo guardado por esta aplicación.',
      planMissingGpx: 'Este plan guardado no contiene un GPX incrustado. Procesa el GPX original una vez y vuelve a cargar el plan.',
      loadFailed: 'No se pudo cargar el archivo.\n\n{{message}}'
    }
  },
  ca: {
    topBar: {
      author: 'Fet amb ☕️ per Charlie Centa'
    },
    language: {
      label: 'Llengua'
    },
    buttons: {
      save: 'Desar',
      load: 'Carregar',
      process: 'Processar GPX',
      clearRoadbooks: 'Netejar roadbooks',
      exportCsv: 'Exportar CSV',
      print: 'Imprimir',
      themeToggle: 'Canviar tema',
      selectFile: 'Seleccionar fitxer',
      changeFile: 'Canviar fitxer'
    },
    sections: {
      gpxUpload: 'Pujada GPX',
      settings: 'Configuració',
      map: 'Mapa',
      summary: 'Resum',
      itinerary: 'Itinerari'
    },
    dropzone: {
      title: 'Pujar fitxer GPX',
      instructions: 'Arrossega i deixa anar un fitxer GPX aquí, o',
      ariaLabel: 'Pujar fitxer GPX',
      readyPrefix: 'Preparat:',
      errorPrefix: 'Error:',
      readyStatus: '{{name}} · {{size}}'
    },
    settings: {
      activity: 'Activitat',
      flatSpeed: 'Velocitat en pla (km/h)',
      vertSpeed: 'Velocitat vertical (m/h)',
      downhillFactor: 'Factor de baixada',
      resample: 'Re-mostatge (m)',
      smoothWindow: 'Finestra de suavitzat (m)',
      elevDeadband: 'Banda morta d\'altitud (m)',
      advancedToggle: 'Mostrar configuració avançada',
      importRoadbooks: 'Importar roadbooks des del GPX'
    },
    activity: {
      hike: 'Senderisme / trail',
      mtb: 'Ciclisme de muntanya',
      road: 'Ciclisme de carretera'
    },
    help: {
      downhillLabel: 'Informació del factor de baixada',
      downhillTip: 'Factor multiplicador per als trams de baixada. 0,66 significa que la baixada tarda dues terceres parts del temps del pla/pujada per al mateix tram. Valors superiors a 1,0 fan la baixada més lenta (terreny tècnic).',
      resampleLabel: 'Informació del re-mostatge',
      resampleTip: 'Crea punts espaiats de manera uniforme al llarg del traçat. Valors petits (p. ex., 1–3 m) capturen millor els revolts però utilitzen més punts. Valors grans són més ràpids amb menys detall.',
      smoothLabel: 'Informació de la finestra de suavitzat',
      smoothTip: 'Mida del filtre de mediana en metres que s\'utilitza per eliminar pics d\'elevació. Finestres petites mantenen el detall; fin
estres grans són més suaus però poden aplanar elements curts.',
      deadbandLabel: 'Informació de la banda morta',
      deadbandTip: 'Ignora les oscil·lacions d\'altitud més petites que aquest llindar quan es calcula l\'ascens/descens (redueix el soroll del GPS). Típic: 1–3 m.'
    },
    map: {
      ariaLabel: 'Mapa de la ruta',
      clear: 'Netejar roadbooks',
      confirmRemoveWaypoint: 'Segur que vols eliminar aquest waypoint?',
      editorLabel: 'Nom del waypoint',
      editorSave: 'Desar',
      editorCancel: 'Cancel·lar',
      editorDelete: 'Eliminar'
    },
    labels: {
      start: 'Inici',
      finish: 'Final'
    },
    roadbooks: {
      print: 'Imprimir',
      exportCsv: 'Exportar CSV'
    },
    table: {
      headers: {
        index: '#',
        name: 'Nom',
        critical: 'Crític',
        leg: 'Tram',
        accumulated: 'Acumulat (Σ)',
        time: 'Temps',
        observations: 'Observacions'
      },
      subHeaders: {
        stops: 'Parades',
        cond: 'Cond',
        total: 'Total',
        remaining: 'Rest'
      },
      titles: {
        editName: 'Fes clic per editar el nom',
        markCritical: 'Marcar el tram com a crític',
        stops: 'Minuts enters',
        cond: 'Percentatge enter',
        observations: 'Afegeix notes o comentaris'
      }
    },
    summary: {
      distance: 'Distància:',
      ascent: 'Ascens:',
      descent: 'Descens:',
      activityTime: 'Temps d\'activitat estimat:',
      totalTime: 'Temps total estimat:'
    },
    alerts: {
      uploadPrompt: 'Si us plau, puja un fitxer GPX.',
      noSegments: 'No s\'han trobat segments de traçat al GPX.',
      dropInvalid: 'Arrossega un fitxer .gpx',
      selectedInvalid: 'El fitxer seleccionat no és un .gpx',
      noTable: 'No hi ha cap taula per exportar.',
      planNoEmbeddedGpx: 'Aquest pla desat no té cap GPX incrustat. Processa primer un GPX i després carrega el pla.',
      planLoadedGpx: 'S\'ha carregat un fitxer GPX. (Consell: usa Desar per exportar un JSON que es pugui reprendre.)',
      parseFailed: 'No s\'ha pogut analitzar el JSON del pla. Assegura\'t de seleccionar un fitxer desat per aquesta aplicació.',
      planMissingGpx: 'Aquest pla desat no conté cap GPX incrustat. Processa l\'GPX original un cop i torna a carregar el pla.',
      loadFailed: 'No s\'ha pogut carregar el fitxer.\n\n{{message}}'
    }
  }
};

const fallbackLang = 'en';
let currentLang = fallbackLang;

const listeners = new Set();

function resolveKey(obj, path) {
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

function format(str, vars = {}) {
  if (typeof str !== 'string') return str;
  return str.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const trimmed = key.trim();
    return Object.prototype.hasOwnProperty.call(vars, trimmed) ? vars[trimmed] : '';
  });
}

function applyTranslations(root = document) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = currentLang;
  }
  const textNodes = root.querySelectorAll('[data-i18n]');
  textNodes.forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    const translation = t(key);
    if (translation !== undefined) {
      el.textContent = translation;
    }
  });

  const attrNodes = root.querySelectorAll('[data-i18n-attrs]');
  attrNodes.forEach(el => {
    const mapping = el.getAttribute('data-i18n-attrs');
    if (!mapping) return;
    mapping.split(';').forEach(entry => {
      const [attr, key] = entry.split(':').map(part => part.trim());
      if (!attr || !key) return;
      const translation = t(key);
      if (translation === undefined) return;
      if (attr === 'text') {
        el.textContent = translation;
      } else if (attr.startsWith('data-')) {
        el.setAttribute(attr, translation);
      } else if (attr in el) {
        el[attr] = translation;
      } else {
        el.setAttribute(attr, translation);
      }
    });
  });
}

export function t(key, vars = {}, opts = {}) {
  const lang = opts.lang && translations[opts.lang] ? opts.lang : currentLang;
  const value = resolveKey(translations[lang], key);
  if (value !== undefined) return format(value, vars);
  if (lang !== fallbackLang) {
    const fallbackValue = resolveKey(translations[fallbackLang], key);
    if (fallbackValue !== undefined) return format(fallbackValue, vars);
  }
  if (opts.default !== undefined) return format(opts.default, vars);
  return key;
}

export function setLanguage(lang) {
  const next = translations[lang] ? lang : fallbackLang;
  currentLang = next;
  applyTranslations();
  listeners.forEach(fn => {
    try { fn(currentLang); } catch (err) { console.error(err); }
  });
}

export function initI18n({ defaultLang } = {}) {
  if (defaultLang && translations[defaultLang]) {
    currentLang = defaultLang;
  } else {
    currentLang = fallbackLang;
  }
  applyTranslations();
}

export function onLanguageChange(handler) {
  if (typeof handler !== 'function') return () => {};
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export function getCurrentLanguage() {
  return currentLang;
}

const languageNames = {
  en: 'English',
  es: 'Español',
  ca: 'Català'
};

export function getAvailableLanguages() {
  return Object.keys(translations).map(code => ({ code, label: languageNames[code] || code }));
}

export function getTranslationsForKey(key) {
  return Object.keys(translations)
    .map(code => resolveKey(translations[code], key))
    .filter(value => typeof value === 'string');
}

