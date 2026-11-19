import { createHash, X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
import { appOrigin, authOrigin, testKey } from './test/auth/settings';

const certificate = new X509Certificate(readFileSync('test-results/auth/tls/server.crt'));
const fixtureKey = createHash('sha256')
  .update(certificate.publicKey.export({ type: 'spki', format: 'der' }))
  .digest('base64');

export default defineConfig({
  testDir: './test/auth',
  testMatch: '**/*.pw.ts',
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/auth/results.json' }]],
  outputDir: 'test-results/auth/artifacts',
  use: {
    baseURL: appOrigin,
    launchOptions: {
      args: [
        '--host-resolver-rules=MAP kaq-idp 127.0.0.1',
        '--no-proxy-server',
        `--ignore-certificate-errors-spki-list=${fixtureKey}`,
      ],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'bun run dev --host 127.0.0.1',
    url: appOrigin,
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: authOrigin,
      VITE_SUPABASE_PUBLISHABLE_KEY: testKey('anon'),
      VITE_AUTH_GITHUB_ENABLED: 'true',
      VITE_AUTH_GOOGLE_ENABLED: 'true',
    },
  },
});
