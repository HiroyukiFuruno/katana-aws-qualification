import { expect, test } from 'bun:test';
import {
  type DeleteAccountEnvironment,
  deleteAccount,
} from '../supabase/functions/delete-account/handler';

const environment: DeleteAccountEnvironment = {
  authUrl: 'https://project.supabase.test',
  serviceRoleKey: 'service-role-only-on-server',
  allowedOrigin: 'https://kaq.example',
};

function request(authorization: string | null) {
  return new Request('https://functions.example/delete-account', {
    method: 'POST',
    headers: authorization
      ? { Origin: environment.allowedOrigin, Authorization: authorization }
      : { Origin: environment.allowedOrigin },
  });
}

test('missing or malformed bearer tokens are rejected without an upstream request', async () => {
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return new Response();
  };
  expect((await deleteAccount(request(null), environment, fetcher)).status).toBe(401);
  expect((await deleteAccount(request('Basic user-token'), environment, fetcher)).status).toBe(401);
  expect(calls).toBe(0);
});

test('offline verification and upstream 5xx fail safely as 502 with CORS retained', async () => {
  const offline = await deleteAccount(request('Bearer user-token'), environment, async () => {
    throw new Error('offline');
  });
  const unavailable = await deleteAccount(
    request('Bearer user-token'),
    environment,
    async () => new Response(null, { status: 503 }),
  );
  expect(offline.status).toBe(502);
  expect(unavailable.status).toBe(502);
  expect(offline.headers.get('Access-Control-Allow-Origin')).toBe(environment.allowedOrigin);
  expect(unavailable.headers.get('Access-Control-Allow-Origin')).toBe(environment.allowedOrigin);
});

test('a deletion confirmation fetch failure never returns success', async () => {
  let calls = 0;
  const result = await deleteAccount(request('Bearer user-token'), environment, async () => {
    calls += 1;
    if (calls === 1) return Response.json({ id: 'verified-user' });
    if (calls === 2) return new Response(null, { status: 204 });
    throw new Error('offline');
  });
  expect(result.status).toBe(502);
  expect(result.headers.get('Access-Control-Allow-Origin')).toBe(environment.allowedOrigin);
});
