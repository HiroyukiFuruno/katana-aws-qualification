import { defineConfig } from '@playwright/test';
import { appOrigin, fixtureKey, gatewayOrigin } from './test/progress/settings';

export default defineConfig({
  outputDir: 'test-results/progress/artifacts',
  reporter: [['list'], ['json', { outputFile: 'test-results/progress/results.json' }]],
  retries: 0,
  testDir: './test/progress',
  testMatch: '**/*.pw.ts',
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: appOrigin,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'bun run dev --host 127.0.0.1 --port 5273',
    env: {
      VITE_SUPABASE_PUBLISHABLE_KEY: fixtureKey('anon'),
      VITE_SUPABASE_URL: gatewayOrigin,
    },
    reuseExistingServer: false,
    url: appOrigin,
  },
});
