import { defineConfig } from 'vite';

export default defineConfig({
  appType: 'mpa',
  publicDir: false,
  server: {
    host: '127.0.0.1',
    port: 54533,
    strictPort: true,
    headers: { 'Referrer-Policy': 'no-referrer' },
  },
});
