import { DEFAULT_SETTINGS, type ExtensionSettings } from '../lib/types';

let contentScriptFilesPromise: Promise<string[]> | null = null;

function getContentScriptFiles(): Promise<string[]> {
  if (!contentScriptFilesPromise) {
    contentScriptFilesPromise = fetch(chrome.runtime.getURL('content-script.json'))
      .then((res) => res.json())
      .then((data: { files?: string[] }) => {
        const files = data.files?.filter(Boolean) ?? [];
        if (files.length === 0) {
          throw new Error('No content script files in content-script.json');
        }
        return files;
      });
  }
  return contentScriptFilesPromise;
}

async function getSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(['settings']);
  return { ...DEFAULT_SETTINGS, ...(stored.settings as Partial<ExtensionSettings> | undefined) };
}

async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ settings });
}

async function getActiveTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null) return tab.id;
  return null;
}

function isInjectableUrl(url: string | undefined): boolean {
  if (!url) return false;
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('file://')
  );
}

async function injectContentScript(tabId: number): Promise<void> {
  const files = await getContentScriptFiles();
  await chrome.scripting.executeScript({
    target: { tabId },
    files,
  });
}

async function sendToTab<T>(tabId: number, message: object): Promise<T> {
  try {
    return (await chrome.tabs.sendMessage(tabId, message)) as T;
  } catch (firstError) {
    // Content script not loaded yet (common right after install) — inject and retry.
    try {
      await injectContentScript(tabId);
      await new Promise((r) => setTimeout(r, 100));
      return (await chrome.tabs.sendMessage(tabId, message)) as T;
    } catch {
      throw firstError;
    }
  }
}

async function toggleActiveTab(): Promise<ExtensionSettings> {
  const tabId = await getActiveTabId();
  if (!tabId) return getSettings();

  const result = await sendToTab<{ settings: ExtensionSettings }>(tabId, {
    type: 'TOGGLE',
  });
  return result?.settings ?? getSettings();
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-measure') {
    void toggleActiveTab();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    try {
      if (message.type === 'POPUP_TOGGLE') {
        const tabId = await getActiveTabId();
        if (!tabId) {
          sendResponse({ error: 'No active tab' });
          return;
        }
        const result = await sendToTab(tabId, { type: 'TOGGLE' });
        sendResponse(result);
        return;
      }
      if (message.type === 'POPUP_UPDATE') {
        const settings = message.settings as ExtensionSettings;
        const tabId = await getActiveTabId();

        if (!tabId) {
          if (settings.active) {
            sendResponse({
              ok: false,
              error: 'No active tab — open a web page first.',
              connected: false,
            });
            return;
          }
          await saveSettings(settings);
          sendResponse({ ok: true, connected: false });
          return;
        }

        const tab = await chrome.tabs.get(tabId);
        if (settings.active && !isInjectableUrl(tab.url)) {
          sendResponse({
            ok: false,
            error:
              'Cannot run on this page. Open your app in a normal tab (http/https), refresh (F5), then enable.',
            connected: false,
          });
          return;
        }

        try {
          const result = await sendToTab<{ ok: boolean; ready?: boolean }>(tabId, {
            type: 'UPDATE_SETTINGS',
            settings,
          });
          await saveSettings(settings);
          sendResponse({
            ok: true,
            connected: true,
            ready: result?.ready ?? settings.active,
          });
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          sendResponse({
            ok: false,
            error: settings.active
              ? `Could not start on this tab. Refresh the page (F5) and try again. (${detail})`
              : detail,
            connected: false,
          });
        }
        return;
      }
      if (message.type === 'POPUP_GET_STATE') {
        const settings = await getSettings();
        const tabId = await getActiveTabId();
        let connected = false;
        let ready = false;
        if (tabId) {
          try {
            const state = await sendToTab<{
              injected: boolean;
              ready: boolean;
            }>(tabId, { type: 'GET_STATE' });
            connected = true;
            ready = state?.ready ?? false;
          } catch {
            connected = false;
          }
        }
        sendResponse({ settings, connected, ready });
        return;
      }
    } catch (err) {
      sendResponse({ error: String(err), connected: false });
    }
  })();
  return true;
});

// Seed defaults on first install only — do not wipe settings on extension reload/update.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== 'install') return;
  void chrome.storage.local.set({
    settings: { ...DEFAULT_SETTINGS, active: false },
  });
});
