import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Ionic Measure',
  version: '0.1.0',
  description:
    'Pixel-perfect dimension overlays for Ionic components — batch internal metrics and spacing between elements.',
  permissions: ['activeTab', 'scripting', 'storage'],
  host_permissions: ['<all_urls>'],
  action: {
    default_popup: 'src/popup/popup.html',
    default_title: 'Ionic Measure',
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/content.ts'],
      run_at: 'document_idle',
    },
  ],
  commands: {
    'toggle-measure': {
      suggested_key: { default: 'Alt+Shift+M', mac: 'Alt+Shift+M' },
      description: 'Toggle measurement overlay',
    },
  },
  icons: {
    '16': 'icons/icon16.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },
});
