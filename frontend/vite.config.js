import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';
import { securityHeadersPlugin } from './vite-security-headers-plugin.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.VITE_PORT || 3000);
  const host = env.VITE_HOST || 'localhost';
  const useHttps = env.VITE_HTTPS !== 'false';
  const httpsOpts = useHttps
    ? {
        key: fs.readFileSync(path.resolve('cert/key.pem')),
        cert: fs.readFileSync(path.resolve('cert/cert.pem')),
      }
    : false;

  return {
    plugins: [react(), tailwindcss(), securityHeadersPlugin()],
    optimizeDeps: {
      include: ['leaflet', 'react-leaflet', 'echarts', 'echarts-for-react', 'tslib', '@xterm/xterm', '@xterm/addon-fit'],
    },
    server: {
      port,
      host,
      https: httpsOpts,
    },
    preview: {
      port,
      host,
      https: httpsOpts,
      strictPort: true,
    },
  };
});
