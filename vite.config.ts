import { defineConfig } from 'vite';

// VITE_BASE wird vom GitHub-Pages-Workflow gesetzt (z. B. /milano-map/).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
});
