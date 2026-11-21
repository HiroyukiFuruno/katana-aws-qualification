import { createHash, X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
import { appOrigin, artifacts } from './test/account-merge/settings';

const certificate = new X509Certificate(readFileSync(`${artifacts}/tls/server.crt`));
const fixtureKey = createHash('sha256')
  .update(certificate.publicKey.export({ type: 'spki', format: 'der' }))
  .digest('base64');

export default defineConfig({
  testDir: './test/account-sdk',
  testMatch: '**/*.pw.ts',
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: `${artifacts}/sdk-results.json` }]],
  outputDir: `${artifacts}/sdk-browser`,
  use: {
    baseURL: appOrigin,
    launchOptions: {
      args: [
        '--host-resolver-rules=MAP kaq-merge-idp 127.0.0.1,MAP kaq-merge-gateway 127.0.0.1',
        '--no-proxy-server',
        `--ignore-certificate-errors-spki-list=${fixtureKey}`,
      ],
    },
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'bunx vite --config test/account-sdk/vite.config.ts',
    url: `${appOrigin}/test/account-sdk/browser.html`,
    reuseExistingServer: false,
  },
});
