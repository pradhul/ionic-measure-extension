import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = join(import.meta.dirname, '..');
const distDir = join(rootDir, 'dist');
const manifestPath = join(distDir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const contentScripts = manifest.content_scripts ?? [];
const files = contentScripts.flatMap(({ js = [] }) => js);

if (files.length === 0) {
  throw new Error('No content script files found in manifest — CRXJS build may have failed.');
}

writeFileSync(
  join(distDir, 'content-script.json'),
  JSON.stringify({ files }, null, 2),
);

// Keep content_scripts in manifest so the script loads on navigation.
// content-script.json is still used for programmatic injection fallback.
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

writeFileSync(
  join(distDir, 'LOAD_IN_CHROME.txt'),
  [
    'Load this dist/ folder OR the project root in chrome://extensions.',
    '',
    'Project root is synced on every npm run build.',
    '',
    'After loading: open a web page, press F5 to refresh, then enable Active in the popup.',
    '',
  ].join('\n'),
);

function syncBuiltExtensionToRoot() {
  const copyFile = (name) => {
    cpSync(join(distDir, name), join(rootDir, name));
  };

  copyFile('manifest.json');
  copyFile('service-worker-loader.js');
  copyFile('content-script.json');
  cpSync(join(distDir, 'assets'), join(rootDir, 'assets'), { recursive: true });

  const popupDir = join(rootDir, 'popup');
  mkdirSync(popupDir, { recursive: true });

  let popupHtml = readFileSync(join(distDir, 'src/popup/popup.html'), 'utf8');
  popupHtml = popupHtml.replace(/\.\.\/\.\.\/assets\//g, '../assets/');
  writeFileSync(join(popupDir, 'popup.html'), popupHtml);

  const rootManifest = {
    ...manifest,
    action: {
      ...manifest.action,
      default_popup: 'popup/popup.html',
    },
  };
  writeFileSync(join(rootDir, 'manifest.json'), JSON.stringify(rootManifest, null, 2));
}

syncBuiltExtensionToRoot();

console.log('finalize-manifest: wrote content-script.json and synced build to project root');
