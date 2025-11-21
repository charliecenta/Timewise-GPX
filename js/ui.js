// js/ui.js
// UI-only behaviours: theme toggle, advanced toggle, GPX dropzone status,
// printing, and section visibility helpers. No business logic here.

import { t, addLanguageChangeListener } from './i18n.js';

export function setupThemeToggle(opts = {}) {
  const { toggleBtn, logoEl, lightLogoSrc, darkLogoSrc, storageKey = 'gpxplanner-theme' } = opts;
  const root = document.documentElement;

  // initialise from storage or system
  const stored = localStorage.getItem(storageKey);
  if (stored === 'dark' || stored === 'light') {
    root.setAttribute('data-theme', stored);
  } else {
    // leave as-is (CSS may read prefers-color-scheme)
  }
  // set initial logo
  swapLogo(root.getAttribute('data-theme') || 'light');

  toggleBtn?.addEventListener('click', () => {
    const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem(storageKey, next);
    swapLogo(next);
  });

  function swapLogo(theme) {
    if (!logoEl || (!lightLogoSrc && !darkLogoSrc)) return;
    if (theme === 'dark' && darkLogoSrc) logoEl.src = darkLogoSrc;
    if (theme !== 'dark' && lightLogoSrc) logoEl.src = lightLogoSrc;
  }
}

export function setupAdvancedToggle({ checkbox, settingsCard }) {
  if (!checkbox || !settingsCard) return;
  // default hidden
  checkbox.checked = false;
  settingsCard.classList.remove('show-adv');

  checkbox.addEventListener('change', () => {
    settingsCard.classList.toggle('show-adv', checkbox.checked);
  });
}

/**
 * Drag & drop + chooser UI for GPX file.
 */
export function setupGpxDropzone({ dropEl, fileInput, selectBtn, statusEl, clearBtn, onBeforeFileAccept, onFileAccepted }) {
  if (!dropEl || !fileInput) return;

  const on = (el, evts, fn) => evts.forEach(evt => el.addEventListener(evt, fn));

  const highlight = (e) => { e.preventDefault(); e.stopPropagation(); dropEl.classList.add('dragover'); };
  const unhighlight = (e) => { e.preventDefault(); e.stopPropagation(); dropEl.classList.remove('dragover'); };

  on(dropEl, ['dragenter','dragover'], highlight);
  on(dropEl, ['dragleave','drop'],    unhighlight);

  const kib = (n) => (n / 1024).toFixed(1) + ' KB';
  const state = { mode: 'idle', file: null, error: null };

  const renderState = () => {
    if (state.mode === 'ready' && state.file) {
      dropEl.classList.remove('error');
      dropEl.classList.add('uploaded');
      if (statusEl) statusEl.innerHTML = t('gpx.ready', { name: state.file.name, size: kib(state.file.size) });
      if (selectBtn) selectBtn.textContent = t('buttons.changeFile');
    } else if (state.mode === 'error') {
      dropEl.classList.remove('uploaded');
      dropEl.classList.add('error');
      const message = state.error ? t(state.error.key, state.error.args) : '';
      if (statusEl) statusEl.innerHTML = t('gpx.error', { message });
      if (selectBtn) selectBtn.textContent = t('buttons.selectFile');
    } else {
      dropEl.classList.remove('uploaded', 'error');
      if (statusEl) statusEl.textContent = '';
      if (selectBtn) selectBtn.textContent = t('buttons.selectFile');
    }
  };

  const setReady = (file) => {
    state.mode = 'ready';
    state.file = file;
    state.error = null;
    renderState();
  };

  const setErrorKey = (key, args = {}) => {
    state.mode = 'error';
    state.file = null;
    state.error = { key, args };
    renderState();
  };

  const clearState = () => {
    state.mode = 'idle';
    state.file = null;
    state.error = null;
    renderState();
  };

  const restorePreviousFile = () => {
    if (state.file) {
      const dt = new DataTransfer();
      dt.items.add(state.file);
      fileInput.files = dt.files;
      renderState();
      return;
    }
    fileInput.value = '';
    clearState();
  };

  renderState();
  addLanguageChangeListener(renderState);

  // Drop handler → feed into input
  dropEl.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer?.files || []);
    const gpx = files.find(f => /\.gpx$/i.test(f.name) || f.type === 'application/gpx+xml');
    if (!gpx) { setErrorKey('gpx.errors.dropWrongType'); return; }
    const dt = new DataTransfer();
    dt.items.add(gpx);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Click/keyboard open chooser
  selectBtn?.addEventListener('click', () => fileInput.click());
  dropEl.addEventListener('click', (e) => {
    if (!(e.target instanceof HTMLButtonElement)) fileInput.click();
  });
  dropEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });

  // Input change → status update
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    if (!f) { clearState(); return; }
    if (!/\.gpx$/i.test(f.name) && f.type !== 'application/gpx+xml') {
      setErrorKey('gpx.errors.selectWrongType');
      return;
    }

    if (onBeforeFileAccept) {
      const allowed = await onBeforeFileAccept({ newFile: f, currentFile: state.file });
      if (!allowed) { restorePreviousFile(); return; }
    }
    setReady(f);
    if (onFileAccepted) onFileAccepted(f);
  });

  clearBtn?.addEventListener('click', clearState);
}

/** Toggle the visibility of the main sections (map, summary, table). */
export function showMainSections(show) {
  const ids = ['mapCard', 'summaryCard', 'roadbooksCard'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('is-hidden', !show);
  });
}

/** Hook up a simple print button. (CSS @media print decides what shows.) */
export function setupPrintButton({ printBtn }) {
  if (!printBtn) return;
  printBtn.addEventListener('click', () => window.print());
}
