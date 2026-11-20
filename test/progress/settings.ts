import { createHmac } from 'node:crypto';

export const appOrigin = 'http://127.0.0.1:5273';
export const gatewayOrigin = 'http://127.0.0.1:54432';
export const authOrigin = 'http://127.0.0.1:54430';
export const restOrigin = 'http://127.0.0.1:54431';

const jwtSecret = 'kaq-data-integration-jwt-secret-not-for-production';

export function fixtureKey(role: 'anon' | 'service_role') {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ aud: 'authenticated', exp: 4_102_444_800, role });
  return `${header}.${payload}.${createHmac('sha256', jwtSecret).update(`${header}.${payload}`).digest('base64url')}`;
}
