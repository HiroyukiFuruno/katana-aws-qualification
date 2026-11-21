import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { run } from './commands';
import { artifacts, gatewayOrigin } from './settings';

export function prepareFixtures() {
  mkdirSync(`${artifacts}/tls`, { recursive: true });
  mkdirSync(`${artifacts}/realms`, { recursive: true });
  writeFileSync(`${artifacts}/integration.log`, '');
  for (const name of ['first', 'second']) {
    const realm = {
      realm: `merge-${name}`,
      enabled: true,
      registrationAllowed: false,
      clients: [
        {
          clientId: 'kaq-account-merge',
          secret: 'integration-only',
          publicClient: false,
          standardFlowEnabled: true,
          protocol: 'openid-connect',
          redirectUris: [`${gatewayOrigin}/auth/v1/callback`],
          defaultClientScopes: ['profile', 'email'],
        },
      ],
      users: [
        {
          username: 'learner',
          email: `${name}@account-merge.example.test`,
          emailVerified: true,
          enabled: true,
          firstName: 'Synthetic',
          lastName: 'Learner',
          credentials: [{ type: 'password', value: 'integration-only', temporary: false }],
        },
        {
          username: `sdk-${name}`,
          email: `sdk-${name}@account-merge.example.test`,
          emailVerified: true,
          enabled: true,
          firstName: 'SDK',
          lastName: name === 'first' ? 'Source' : 'Target',
          credentials: [{ type: 'password', value: 'integration-only', temporary: false }],
        },
      ],
    };
    writeFileSync(`${artifacts}/realms/merge-${name}.json`, JSON.stringify(realm, null, 2));
  }
  run('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    `${artifacts}/tls/server.key`,
    '-out',
    `${artifacts}/tls/server.crt`,
    '-days',
    '2',
    '-subj',
    '/CN=kaq-merge-idp',
    '-addext',
    'subjectAltName=DNS:kaq-merge-idp,DNS:localhost,IP:127.0.0.1',
    '-addext',
    'basicConstraints=critical,CA:TRUE',
  ]);
  // 非rootの実IdPが毎回生成するテスト専用鍵を読み取れるようにする。
  chmodSync(`${artifacts}/tls/server.key`, 0o644);
}
