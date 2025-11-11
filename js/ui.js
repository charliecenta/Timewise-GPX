// js/ui.js
// UI-only behaviours: theme toggle, advanced toggle, GPX dropzone status,
// printing, and section visibility helpers. No business logic here.

import { t, onLanguageChange } from './i18n.js';

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
 * This does *not* parse files; it only updates the UI and enables the Process button.
 */
export function setupGpxDropzone({ dropEl, fileInput, selectBtn, statusEl, processBtn, clearBtn }) {
  if (!dropEl || !fileInput) return;

  const on = (el, evts, fn) => evts.forEach(evt => el.addEventListener(evt, fn));

  const highlight = (e) => { e.preventDefault(); e.stopPropagation(); dropEl.classList.add('dragover'); };
  const unhighlight = (e) => { e.preventDefault(); e.stopPropagation(); dropEl.classList.remove('dragover'); };

  on(dropEl, ['dragenter','dragover'], highlight);
  on(dropEl, ['dragleave','drop'],    unhighlight);

  const kib = (n) => (n/1024).toFixed(1) + ' KB';

  let statusState = { kind: 'idle' };

  const renderStatus = () => {
    if (selectBtn) {
      const key = statusState.kind === 'ready' ? 'buttons.changeFile' : 'buttons.selectFile';
      selectBtn.textContent = t(key);
    }
    if (!statusEl) return;
    if (statusState.kind === 'ready') {
      const size = kib(statusState.size || 0);
      statusEl.innerHTML = `<span class="ok">${t('dropzone.readyPrefix')}</span> ${t('dropzone.readyStatus', { name: statusState.name || '', size })}`;
    } else if (statusState.kind === 'error') {
      const message = t(statusState.key, statusState.params);
      statusEl.innerHTML = `<span class="err">${t('dropzone.errorPrefix')}</span> ${message}`;
    } else {
      statusEl.textContent = '';
    }
  };

  const setReady = (file) => {
    dropEl.classList.remove('error');
    dropEl.classList.add('uploaded');
    statusState = { kind: 'ready', name: file.name, size: file.size };
    if (processBtn) processBtn.disabled = false;
    renderStatus();
  };

  const setError = (key, params = {}) => {
    dropEl.classList.remove('uploaded');
    dropEl.classList.add('error');
    statusState = { kind: 'error', key, params };
    if (processBtn) processBtn.disabled = true;
    renderStatus();
  };

  const clearState = () => {
    dropEl.classList.remove('uploaded','error');
    statusState = { kind: 'idle' };
    renderStatus();
    // if you want to disable Process until next selection, uncomment:
    // if (processBtn) processBtn.disabled = true;
  };

  // Drop handler → feed into input
  dropEl.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer?.files || []);
    const gpx = files.find(f => /\.gpx$/i.test(f.name) || f.type === 'application/gpx+xml');
    if (!gpx) { setError('alerts.dropInvalid'); return; }
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
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (!f) { clearState(); return; }
    if (!/\.gpx$/i.test(f.name) && f.type !== 'application/gpx+xml') {
      setError('alerts.selectedInvalid');
      return;
    }
    setReady(f);
  });

  clearBtn?.addEventListener('click', clearState);

  onLanguageChange(renderStatus);
  renderStatus();
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
