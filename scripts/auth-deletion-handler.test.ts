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

test('deletion uses only the online-verified bearer subject and confirms the hard delete', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: input.toString(), init });
    if (calls.length === 1) return Response.json({ id: 'verified-user' });
    if (calls.length === 2) return new Response(null, { status: 204 });
    return new Response(null, { status: 404 });
  };
  const result = await deleteAccount(
    new Request('https://functions.example/delete-account', {
      method: 'POST',
      headers: { Origin: environment.allowedOrigin, Authorization: 'Bearer user-token' },
    }),
    environment,
    fetcher,
  );
  expect(result.status).toBe(204);
  expect(calls.map((call) => call.url)).toEqual([
    'https://project.supabase.test/auth/v1/user',
    'https://project.supabase.test/auth/v1/admin/users/verified-user',
    'https://project.supabase.test/auth/v1/admin/users/verified-user',
  ]);
  expect(calls[1].init?.headers).toEqual({
    apikey: environment.serviceRoleKey,
    Authorization: `Bearer ${environment.serviceRoleKey}`,
    'Content-Type': 'application/json',
  });
  expect(calls[1].init?.body).toBe(JSON.stringify({ should_soft_delete: false }));
});

test('deletion rejects a foreign origin and every request body before contacting Auth', async () => {
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return new Response();
  };
  const foreign = await deleteAccount(
    new Request('https://functions.example/delete-account', {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
    }),
    environment,
    fetcher,
  );
  const target = await deleteAccount(
    new Request('https://functions.example/delete-account', {
      method: 'POST',
      headers: { Origin: environment.allowedOrigin, Authorization: 'Bearer user-token' },
      body: JSON.stringify({ userId: 'another-user' }),
    }),
    environment,
    fetcher,
  );
  const preflight = await deleteAccount(
    new Request('https://functions.example/delete-account', {
      method: 'OPTIONS',
      headers: { Origin: environment.allowedOrigin },
    }),
    environment,
    fetcher,
  );
  expect(foreign.status).toBe(403);
  expect(target.status).toBe(400);
  expect(preflight.status).toBe(204);
  expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe(environment.allowedOrigin);
  expect(calls).toBe(0);
});

test('deletion fails closed unless the admin reread returns 404', async () => {
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    if (calls === 1) return Response.json({ id: 'verified-user' });
    return new Response(null, { status: 204 });
  };
  const result = await deleteAccount(
    new Request('https://functions.example/delete-account', {
      method: 'POST',
      headers: { Origin: environment.allowedOrigin, Authorization: 'Bearer user-token' },
    }),
    environment,
    fetcher,
  );
  expect(result.status).toBe(502);
});
