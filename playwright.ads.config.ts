import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/ads',
  testMatch: '**/*.pw.ts',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4193' },
  webServer: {
    command: 'VITE_ADSENSE_SERVING=1 bun run build && bunx vite preview --host 127.0.0.1 --port 4193 --strictPort',
    url: 'http://127.0.0.1:4193',
    reuseExistingServer: true,
    timeout: 300000,
  },
});
