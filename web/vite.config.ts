import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const apiPort = process.env.LEASH_API_PORT || '3001';

// If the local API is not running, answer /api calls with a readable JSON error instead of an empty 500.
const api: ProxyOptions = {
  target: `http://localhost:${apiPort}`,
  configure(proxy) {
    proxy.on('error', (_err, _req, res) => {
      const r = res as import('node:http').ServerResponse;
      if (!r.headersSent && typeof r.writeHead === 'function') {
        r.writeHead(502, { 'Content-Type': 'application/json' });
        r.end(JSON.stringify({ error: `The local API server is not running on port ${apiPort}. Start everything with "npm run dev:web".` }));
      }
    });
  },
};

// Dev: `npm run dev:web` serves the page on :5173 and proxies /api to the local API server.
// Build: static files into web/dist.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    assetsInlineLimit: 0,
  },
  server: { proxy: { '/api': api } },
  preview: { proxy: { '/api': api } },
});
