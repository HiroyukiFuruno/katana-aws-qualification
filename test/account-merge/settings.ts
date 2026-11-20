import { createHmac } from 'node:crypto';

export const projectName = 'kaq-account-merge-integration';
export const appOrigin = 'http://127.0.0.1:54533';
export const gatewayOrigin = 'http://127.0.0.1:54530';
export const artifacts = 'test-results/account-merge/integration';
export const issuerOrigin = 'https://kaq-merge-idp:54541';
export const compose = ['compose', '-p', projectName, '-f', 'test/account-merge/compose.yml'];

export function testKey(role: 'anon' | 'service_role' = 'anon') {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role, exp: 4102444800 })}`;
  const signature = createHmac('sha256', 'kaq-account-merge-only-jwt-secret-not-for-production')
    .update(unsigned)
    .digest('base64url');
  return `${unsigned}.${signature}`;
}
