import type { ExtensionSettings } from '../lib/types';

const activeEl = document.getElementById('active') as HTMLInputElement;
const statusLabel = document.getElementById('status-label')!;
const connectionBanner = document.getElementById('connection-banner')!;
const modeEl = document.getElementById('mode') as HTMLSelectElement;
const snapEl = document.getElementById('snap-ion') as HTMLInputElement;
const minSizeEl = document.getElementById('min-size') as HTMLInputElement;
const clearBtn = document.getElementById('clear') as HTMLButtonElement;

function readForm(): ExtensionSettings {
  return {
    active: activeEl.checked,
    mode: modeEl.value as ExtensionSettings['mode'],
    depthFilter: 'direct',
    snapToIonHost: snapEl.checked,
    minSizePx: Number(minSizeEl.value) || 2,
  };
}

function applyToForm(settings: ExtensionSettings): void {
  activeEl.checked = settings.active;
  modeEl.value = settings.mode;
  snapEl.checked = settings.snapToIonHost;
  minSizeEl.value = String(settings.minSizePx);
  statusLabel.textContent = settings.active ? 'Active on page' : 'Inactive';
  statusLabel.style.color = settings.active ? '#0ea5e9' : '#64748b';
}

function setConnectionStatus(connected: boolean, active: boolean): void {
  if (!connected) {
    connectionBanner.hidden = false;
    connectionBanner.className = 'banner banner-warn';
    connectionBanner.textContent =
      'Could not reach this tab — toggle Active or press Alt+Shift+M on the page.';
    return;
  }
  if (active) {
    connectionBanner.hidden = false;
    connectionBanner.className = 'banner banner-ok';
    connectionBanner.textContent =
      'Connected. In alignment mode you will see guide lines; switch to Component or Spacing for HUD details.';
    return;
  }
  connectionBanner.hidden = true;
}

function revertActiveToggle(): void {
  activeEl.checked = false;
  statusLabel.textContent = 'Inactive';
  statusLabel.style.color = '#64748b';
}

async function pushSettings(): Promise<void> {
  const settings = readForm();
  applyToForm(settings);
  try {
    const result = (await chrome.runtime.sendMessage({
      type: 'POPUP_UPDATE',
      settings,
    })) as { connected?: boolean; error?: string; ok?: boolean };
    const failed = Boolean(result?.error) || result?.ok === false;
    if (failed && settings.active) {
      revertActiveToggle();
      setConnectionStatus(false, false);
      connectionBanner.hidden = false;
      connectionBanner.className = 'banner banner-warn';
      connectionBanner.textContent =
        result?.error ??
        'Could not enable on this tab — refresh the page (F5) and try again.';
      return;
    }
    setConnectionStatus(result?.connected !== false, settings.active);
    if (result?.error) {
      connectionBanner.hidden = false;
      connectionBanner.className = 'banner banner-warn';
      connectionBanner.textContent = result.error;
    }
  } catch {
    if (settings.active) revertActiveToggle();
    setConnectionStatus(false, false);
  }
}

async function loadState(): Promise<void> {
  try {
    const state = (await chrome.runtime.sendMessage({
      type: 'POPUP_GET_STATE',
    })) as {
      settings: ExtensionSettings;
      connected?: boolean;
    };
    if (state?.settings) applyToForm(state.settings);
    setConnectionStatus(state?.connected !== false, state?.settings?.active ?? false);
  } catch {
    setConnectionStatus(false, false);
  }
}

function setFormEnabled(enabled: boolean): void {
  activeEl.disabled = !enabled;
  modeEl.disabled = !enabled;
  snapEl.disabled = !enabled;
  minSizeEl.disabled = !enabled;
  clearBtn.disabled = !enabled;
}

activeEl.addEventListener('change', () => void pushSettings());
modeEl.addEventListener('change', () => void pushSettings());
snapEl.addEventListener('change', () => void pushSettings());
minSizeEl.addEventListener('change', () => void pushSettings());

clearBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'CLEAR' });
    } catch {
      setConnectionStatus(false, activeEl.checked);
    }
  }
});

void (async () => {
  setFormEnabled(false);
  await loadState();
  setFormEnabled(true);
})();
