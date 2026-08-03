import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// meSpeak's generated engine is Latin-1; decode it before Vite parses the module.
const legacyMeSpeakSource = /[/\\]mespeak[/\\]src[/\\]ESpeak\.js$/;

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    {
      name: 'load-mespeak-latin1-source',
      enforce: 'pre',
      load(id) {
        const filename = id.split('?', 1)[0];
        if (legacyMeSpeakSource.test(filename)) return readFileSync(filename, 'latin1');
      },
    },
    react(),
  ],
  build: {
    outDir: 'dist/client',
  },
});
