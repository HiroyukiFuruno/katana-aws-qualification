import { expect, mock, test } from 'bun:test';
import { createProgressApi } from '../src/progress/api';

const configuration = { url: 'https://learning.example', key: 'public-key' };

test('progress reads every server-limited page with authenticated requests', async () => {
  const requests: RequestInit[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = mock(async (_input: unknown, init?: RequestInit) => {
    requests.push(init ?? {});
    const second = requests.length === 2;
    return new Response(
      JSON.stringify(second ? [{ event_id: 'c' }] : [{ event_id: 'a' }, { event_id: 'b' }]),
      {
        headers: { 'Content-Range': second ? '2-2/3' : '0-1/3' },
      },
    );
  }) as typeof fetch;
  try {
    const api = createProgressApi(
      configuration,
      async () => 'verified-token',
      () => true,
    );
    expect(await api.select('learning_events')).toEqual([
      { event_id: 'a' },
      { event_id: 'b' },
      { event_id: 'c' },
    ]);
    expect(new Headers(requests[0].headers).get('Authorization')).toBe('Bearer verified-token');
    expect(new Headers(requests[1].headers).get('Range')).toBe('2-1001');
    expect(new Headers(requests[0].headers).get('apikey')).toBe('public-key');
  } finally {
    globalThis.fetch = original;
  }
});

test('progress rejects a collection whose total changes between pages', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = mock(async (_input: unknown, init?: RequestInit) => {
    const range = new Headers(init?.headers).get('Range');
    return new Response(
      JSON.stringify(range?.startsWith('0-') ? [{ event_id: 'a' }] : [{ event_id: 'b' }]),
      {
        headers: { 'Content-Range': range?.startsWith('0-') ? '0-0/2' : '1-1/3' },
      },
    );
  }) as typeof fetch;
  try {
    const api = createProgressApi(
      configuration,
      async () => 'token',
      () => true,
    );
    await expect(api.select('learning_events')).rejects.toThrow(
      'Learning collection changed during read',
    );
  } finally {
    globalThis.fetch = original;
  }
});

test('progress rejects a duplicate row spanning pages', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = mock(async (_input: unknown, init?: RequestInit) => {
    const range = new Headers(init?.headers).get('Range');
    return new Response(JSON.stringify([{ event_id: 'same' }]), {
      headers: { 'Content-Range': range?.startsWith('0-') ? '0-0/2' : '1-1/2' },
    });
  }) as typeof fetch;
  try {
    const api = createProgressApi(
      configuration,
      async () => 'token',
      () => true,
    );
    await expect(api.select('learning_events')).rejects.toThrow('Duplicate learning row received');
  } finally {
    globalThis.fetch = original;
  }
});

test('an owner switch during authorization prevents any data request', async () => {
  let active = true;
  const original = globalThis.fetch;
  const fetcher = mock(async () => new Response('null'));
  globalThis.fetch = fetcher as typeof fetch;
  try {
    const api = createProgressApi(
      configuration,
      async () => {
        active = false;
        return 'old-token';
      },
      () => active,
    );
    await expect(api.rpc('reset_my_learning_data', {})).rejects.toThrow('Learning account changed');
    expect(fetcher).not.toHaveBeenCalled();
  } finally {
    globalThis.fetch = original;
  }
});

test('versioned progress RPCs retain the operation-name boundary', async () => {
  const requests: Request[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(new Request(input, init));
    return new Response('[]');
  }) as typeof fetch;
  try {
    const api = createProgressApi(
      configuration,
      async () => 'token',
      () => true,
    );
    await api.rpc('load_roadmap_profile_snapshot_v2', {});
    expect(requests[0]?.url).toContain('/rpc/load_roadmap_profile_snapshot_v2');
    await expect(api.rpc('load_roadmap_profile_snapshot_v0', {})).rejects.toThrow(
      'Invalid learning operation',
    );
  } finally {
    globalThis.fetch = original;
  }
});

test('an owner switch while reading discards the old response', async () => {
  let active = true;
  const original = globalThis.fetch;
  globalThis.fetch = mock(async () => {
    active = false;
    return new Response('[{"private":"previous owner"}]', { headers: { 'Content-Range': '0-0/1' } });
  }) as typeof fetch;
  try {
    const api = createProgressApi(
      configuration,
      async () => 'old-token',
      () => active,
    );
    await expect(api.select('learning_events')).rejects.toThrow('Learning account changed');
  } finally {
    globalThis.fetch = original;
  }
});
