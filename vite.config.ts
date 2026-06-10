import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config.json';

export default defineConfig({
  base: './',
  plugins: [crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        popup: 'src/popup/popup.html',
      },
    },
  },
});
