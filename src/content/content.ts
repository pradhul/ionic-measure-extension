import { MeasureController } from '../lib/picker';
import { DEFAULT_SETTINGS, type ExtensionSettings } from '../lib/types';

declare global {
  interface Window {
    __ionicMeasureLoaded?: boolean;
  }
}

let controller: MeasureController | null = null;
let initialized = false;

async function loadSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(['settings']);
  return { ...DEFAULT_SETTINGS, ...(stored.settings as Partial<ExtensionSettings> | undefined) };
}

async function applySettings(settings: ExtensionSettings): Promise<void> {
  if (settings.active) {
    if (!controller) {
      controller = new MeasureController(settings);
      controller.start();
    } else {
      controller.updateSettings(settings);
    }
  } else if (controller) {
    controller.stop();
    controller = null;
  }
}

function initContentScript(): void {
  if (initialized) return;
  initialized = true;
  window.__ionicMeasureLoaded = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    void (async () => {
      try {
        if (message.type === 'GET_STATE') {
          const settings = await loadSettings();
          sendResponse({ settings, injected: true, ready: Boolean(controller) });
          return;
        }
        if (message.type === 'UPDATE_SETTINGS') {
          const settings = message.settings as ExtensionSettings;
          await chrome.storage.local.set({ settings });
          await applySettings(settings);
          sendResponse({ ok: true, ready: Boolean(controller) });
          return;
        }
        if (message.type === 'TOGGLE') {
          const settings = await loadSettings();
          settings.active = !settings.active;
          await chrome.storage.local.set({ settings });
          await applySettings(settings);
          sendResponse({ settings, ready: Boolean(controller) });
          return;
        }
        if (message.type === 'CLEAR') {
          controller?.clearSelection();
          sendResponse({ ok: true });
          return;
        }
        if (message.type === 'PING') {
          sendResponse({ ok: true, ready: Boolean(controller) });
          return;
        }
      } catch (err) {
        sendResponse({ error: String(err) });
      }
    })();
    return true;
  });

  void (async () => {
    const settings = await loadSettings();
    if (settings.active) await applySettings(settings);
  })();
}

/** CRXJS calls this after dynamically importing the content module. */
export function onExecute(): void {
  initContentScript();
}

// Also init on direct evaluation (fallback if loader pattern changes).
initContentScript();
