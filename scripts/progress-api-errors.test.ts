import { expect, mock, test } from 'bun:test';
import { createProgressApi, ProgressApiError } from '../src/progress/api';
const configuration = { url: 'https://learning.example', key: 'public-key' };

test('server errors preserve a safe status and code without exposing the raw message', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = mock(
    async () =>
      new Response(JSON.stringify({ code: 'PT412', message: 'private server detail' }), { status: 412 }),
  ) as typeof fetch;
  try {
    const api = createProgressApi(
      configuration,
      async () => 'token',
      () => true,
    );
    const result = await api.rpc('save_exam_response', {}).catch((error: unknown) => error);
    expect(result).toBeInstanceOf(ProgressApiError);
    expect((result as ProgressApiError).status).toBe(412);
    expect((result as ProgressApiError).code).toBe('PT412');
    expect((result as Error).message).not.toContain('private');
  } finally {
    globalThis.fetch = original;
  }
});
