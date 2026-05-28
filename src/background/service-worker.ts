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
        const tabId = await getActiveTabId();
        const settings = message.settings as ExtensionSettings;
        await saveSettings(settings);
        if (!tabId) {
          sendResponse({ ok: false, error: 'No active tab', connected: false });
          return;
        }
        const result = await sendToTab<{ ok: boolean; ready?: boolean }>(tabId, {
          type: 'UPDATE_SETTINGS',
          settings,
        });
        sendResponse({
          ok: true,
          connected: true,
          ready: result?.ready ?? settings.active,
        });
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

// After install / update, content scripts only attach to new navigations.
chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.set({
    settings: { ...DEFAULT_SETTINGS, active: false },
  });
});
