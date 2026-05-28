import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(import.meta.dirname, '..', 'dist');
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

delete manifest.content_scripts;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log('finalize-manifest: removed auto content_scripts; wrote content-script.json');
