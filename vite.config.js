import { Readable } from 'node:stream';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { proxyStation } from './src/streamProxy/proxy.js';

// In production /stream/:id is a Netlify Edge Function; in development the same
// relay runs inside the Vite dev server so http:// stations play locally too.
function streamProxyDev() {
  return {
    name: 'waveter-stream-proxy',
    configureServer(server) {
      server.middlewares.use('/stream', async (req, res) => {
        const id = (req.url || '/').slice(1).split('?')[0];
        const controller = new AbortController();
        req.on('close', () => controller.abort());
        const response = await proxyStation(id, { signal: controller.signal });
        res.writeHead(response.status, Object.fromEntries(response.headers));
        if (!response.body) return res.end();
        if (typeof response.body === 'string') return res.end(response.body);
        Readable.fromWeb(response.body).on('error', () => res.end()).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), streamProxyDev()],
});
