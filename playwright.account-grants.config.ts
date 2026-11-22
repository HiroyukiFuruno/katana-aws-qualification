import { defineConfig } from '@playwright/test';
import merge from './playwright.account-merge.config';
import { artifacts } from './test/account-merge/settings';

export default defineConfig({
  ...merge,
  testMatch: '**/session-grants.pw.ts',
  reporter: [['list'], ['json', { outputFile: `${artifacts}/grants-results.json` }]],
  outputDir: `${artifacts}/grants-browser`,
});
