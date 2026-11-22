import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.pw.ts',
  workers: 1,
  retries: 0,
  outputDir: '../../test-results/questions/artifacts',
  reporter: [
    ['list'],
    ['json', { outputFile: resolve(import.meta.dirname, '../../test-results/questions/results.json') }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:5186',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'bun run dev --host 127.0.0.1 --port 5186',
    url: 'http://127.0.0.1:5186',
    reuseExistingServer: false,
  },
});
