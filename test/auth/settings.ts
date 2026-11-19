import { createHmac } from 'node:crypto';

export const authOrigin = 'http://127.0.0.1:54331';
export const appOrigin = 'http://127.0.0.1:5173';

export function testKey(role: 'anon' | 'service_role') {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const payload = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role, exp: 2208988800 })}`;
  const signature = createHmac('sha256', 'kaq-integration-only-jwt-secret-not-for-production')
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

export const integrationProvider = {
  id: 'integration',
  backend: 'keycloak',
  name: 'Integration OIDC',
  scopes: 'openid email profile',
};
