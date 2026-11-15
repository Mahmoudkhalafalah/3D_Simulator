import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The local compile server (server/index.mjs) listens on 3210.
// In dev, Vite proxies /api to it; in production the server serves dist/ itself.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:3210' },
  },
  build: {
    chunkSizeWarningLimit: 2500,
  },
});
