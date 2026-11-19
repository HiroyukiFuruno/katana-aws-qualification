import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const compose = ['compose', '-f', 'test/auth/compose.yml'];

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${result.status}`);
}

try {
  mkdirSync('test-results/auth/tls', { recursive: true });
  run('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    'test-results/auth/tls/server.key',
    '-out',
    'test-results/auth/tls/server.crt',
    '-days',
    '2',
    '-subj',
    '/CN=kaq-idp',
    '-addext',
    'subjectAltName=DNS:kaq-idp,DNS:localhost,IP:127.0.0.1',
    '-addext',
    'basicConstraints=critical,CA:TRUE',
  ]);
  run('docker', [...compose, 'up', '-d', '--wait', '--wait-timeout', '60']);
  run('bunx', ['playwright', 'test']);
} finally {
  mkdirSync('test-results/auth', { recursive: true });
  const logs = spawnSync('docker', [...compose, 'logs', '--no-color'], { encoding: 'utf8' });
  writeFileSync('test-results/auth/services.log', logs.stdout + logs.stderr);
  run('docker', [...compose, 'down']);
}
