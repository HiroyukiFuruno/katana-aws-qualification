import { defineConfig } from '@playwright/test';
import merge from './playwright.account-merge.config';
import { artifacts } from './test/account-merge/settings';

export default defineConfig({
  ...merge,
  testMatch: '**/account-creation*.pw.ts',
  reporter: [['list'], ['json', { outputFile: `${artifacts}/account-creation-results.json` }]],
  outputDir: `${artifacts}/account-creation-browser`,
});
