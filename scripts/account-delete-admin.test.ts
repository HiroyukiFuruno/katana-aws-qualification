import { expect, test } from 'bun:test';
import { OfficialAuthDeletion } from '../supabase/functions/delete-account/jobs/admin.ts';
import { AuthDeletionUnavailableError } from '../supabase/functions/delete-account/jobs/types.ts';

const uid = '11111111-1111-4111-8111-111111111111';
const environment = { authUrl: 'https://auth.example.test', serviceRoleKey: 'unit-only-service-key' };
const response = (value: object, status = 200) =>
  Response.json(value, { status, headers: { 'X-Supabase-Api-Version': '2024-01-01' } });

test('only the official typed user_not_found response confirms absence', async () => {
  const admin = new OfficialAuthDeletion(environment, async () =>
    response({ code: 'user_not_found', message: 'User not found' }, 404),
  );
  expect(await admin.isAbsent(uid)).toBe(true);
  await admin.remove(uid);
});
for (const body of [{ code: 'route_not_found' }, { message: 'User not found' }]) {
  test(`a generic 404 is never accepted as absence (${JSON.stringify(body)})`, async () => {
    const admin = new OfficialAuthDeletion(environment, async () => response(body, 404));
    await expect(admin.isAbsent(uid)).rejects.toThrow('rejected');
  });
}
test('uses official hard deletion and a service-only header without returning user data', async () => {
  const calls: Request[] = [];
  const admin = new OfficialAuthDeletion(environment, async (input, init) => {
    const request = new Request(input, init);
    calls.push(request);
    return request.method === 'DELETE' ? response({}) : response({ id: uid });
  });
  await admin.remove(uid);
  expect(calls.map((request) => request.method)).toEqual(['GET', 'DELETE']);
  expect(calls.every((request) => request.url.endsWith(`/auth/v1/admin/users/${uid}`))).toBe(true);
  expect(calls[1]?.headers.get('Authorization')).toBe(`Bearer ${environment.serviceRoleKey}`);
  expect(await calls[1]?.json()).toEqual({ should_soft_delete: false });
});
test('a mismatched user or a rate-limited read cannot confirm deletion', async () => {
  const wrong = new OfficialAuthDeletion(environment, async () =>
    response({ id: '22222222-2222-4222-8222-222222222222' }),
  );
  await expect(wrong.isAbsent(uid)).rejects.toThrow('mismatched');
  const limited = new OfficialAuthDeletion(environment, async () =>
    response({ code: 'over_request_rate_limit' }, 429),
  );
  await expect(limited.isAbsent(uid)).rejects.toBeInstanceOf(AuthDeletionUnavailableError);
});
