import { defineConfig } from '@playwright/test';
import progress from './playwright.progress.config';

const origin = 'http://127.0.0.1:5274';

export default defineConfig({
  ...progress,
  outputDir: 'test-results/fundamentals-mobile/artifacts',
  reporter: [['list'], ['json', { outputFile: 'test-results/fundamentals-mobile/results.json' }]],
  testMatch: ['**/fundamentals-mobile.pw.ts', '**/fundamentals-japanese-copy.pw.ts'],
  use: { ...progress.use, baseURL: origin },
  webServer: {
    command: 'bun run dev --host 127.0.0.1 --port 5274',
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' },
    reuseExistingServer: false,
    url: origin,
  },
});
