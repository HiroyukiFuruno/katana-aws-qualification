import { spawnSync } from 'node:child_process';
import { appendFileSync, chmodSync, mkdirSync, writeFileSync } from 'node:fs';

const compose = ['compose', '-f', 'test/auth/compose.yml'];
const integrationLog = 'test-results/auth/deletion-integration.log';

function run(command: string, args: string[], logFile?: string) {
  const result = spawnSync(command, args, logFile ? { encoding: 'utf8' } : { stdio: 'inherit' });
  if (logFile) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    appendFileSync(logFile, output);
    process.stdout.write(output);
  }
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${result.status}`);
}

try {
  mkdirSync('test-results/auth/tls', { recursive: true });
  writeFileSync(integrationLog, '');
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
  // CIの非root IdPからも、毎回生成するテスト専用鍵を読み取れるようにする。
  chmodSync('test-results/auth/tls/server.key', 0o644);
  try {
    run('docker', [...compose, 'up', '-d', '--wait', '--wait-timeout', '60']);
  } catch (error) {
    spawnSync('docker', [...compose, 'logs', '--no-color', 'kaq-idp'], { stdio: 'inherit' });
    throw error;
  }
  run('bunx', ['playwright', 'test', ...process.argv.slice(2)], integrationLog);
} finally {
  mkdirSync('test-results/auth', { recursive: true });
  const logs = spawnSync('docker', [...compose, 'logs', '--no-color'], { encoding: 'utf8' });
  writeFileSync('test-results/auth/services.log', logs.stdout + logs.stderr);
  run('docker', [...compose, 'down']);
}
