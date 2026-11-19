import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

export default defineConfig({
  testDir: '.',
  testMatch: '*.pw.ts',
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: resolve(import.meta.dirname, '../../test-results/glossary/results.json') }],
  ],
  outputDir: '../../test-results/glossary/artifacts',
  use: { baseURL: 'http://127.0.0.1:4197', trace: 'retain-on-failure' },
  webServer: {
    command: 'bun run dev --host 127.0.0.1 --port 4197 --strictPort',
    url: 'http://127.0.0.1:4197',
    reuseExistingServer: false,
  },
});
