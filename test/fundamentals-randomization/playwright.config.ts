import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../auth',
  testMatch: 'fundamentals.pw.ts',
  workers: 1,
  retries: 0,
  outputDir: '../../test-results/fundamentals-randomization/artifacts',
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile: resolve(
          import.meta.dirname,
          '../../test-results/fundamentals-randomization/results.json',
        ),
      },
    ],
  ],
  use: {
    baseURL: 'http://127.0.0.1:5188',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'bun run dev --host 127.0.0.1 --port 5188 --strictPort',
    url: 'http://127.0.0.1:5188',
    reuseExistingServer: false,
  },
});
