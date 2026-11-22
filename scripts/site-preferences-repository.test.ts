import { expect, test } from 'bun:test';
import {
  createSitePreferencesRepository,
  defaultSitePreferences,
  type SitePreferences,
  type SitePreferencesSnapshot,
} from '../src/sitePreferences/repository';
import type { ProgressRpcClient } from '../src/progress/types';

type RpcCall = { name: string; args: Record<string, unknown> };

function client(responses: Record<string, unknown>, calls: RpcCall[]): ProgressRpcClient {
  return {
    async rpc<T>(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      const response = responses[name];
      if (response instanceof Error) throw response;
      return response as T;
    },
    async select<T>() {
      return [] as T;
    },
  };
}

const loaded: SitePreferences = { locale: 'ja', theme: 'dark' };

test('uses the generation returned by load when saving', async () => {
  const calls: RpcCall[] = [];
  const repo = createSitePreferencesRepository(
    client(
      {
        initialize_learning_state: 17,
        load_site_preferences: { ...loaded, revision: 4 },
        save_site_preferences: { locale: 'ja', theme: 'light', revision: 5 },
      },
      calls,
    ),
  );
  const previous = await repo.load();
  await repo.save({ locale: 'ja', theme: 'light' }, previous);
  expect(calls.at(-1)).toMatchObject({
    name: 'save_site_preferences',
    args: { p_expected_generation: 17, p_expected_revision: 4 },
  });
});

test('accepts an idempotent null/null save at the same revision', async () => {
  const calls: RpcCall[] = [];
  const repo = createSitePreferencesRepository(
    client(
      {
        save_site_preferences: { ...defaultSitePreferences, revision: 0 },
      },
      calls,
    ),
  );
  await expect(
    repo.save(defaultSitePreferences, {
      ...defaultSitePreferences,
      generation: 2,
      revision: 0,
    }),
  ).resolves.toEqual({ ...defaultSitePreferences, generation: 2, revision: 0 });
});

test('accepts a retry or another device acknowledgement with equal payload', async () => {
  const calls: RpcCall[] = [];
  let attempt = 0;
  const state = { locale: 'en', theme: 'dark', revision: 4 };
  const rpcClient: ProgressRpcClient = {
    async rpc<T>(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      if (name !== 'save_site_preferences') return 0 as T;
      state.revision = 5;
      if (attempt++ === 0) throw new Error('response lost after commit');
      return { ...state } as T;
    },
    async select<T>() {
      return [] as T;
    },
  };
  const repo = createSitePreferencesRepository(rpcClient);
  const previous: SitePreferencesSnapshot = {
    locale: 'en',
    theme: 'dark' as const,
    generation: 3,
    revision: 4,
  };
  await expect(repo.save({ locale: 'en', theme: 'dark' }, previous)).rejects.toThrow('response lost');
  await expect(repo.save({ locale: 'en', theme: 'dark' }, previous)).resolves.toMatchObject({
    locale: 'en',
    theme: 'dark',
    revision: 5,
  });
  expect(calls).toHaveLength(2);
});

test.each([
  ['unknown locale', { locale: 'xx', theme: null, revision: 1 }],
  ['invalid theme type', { locale: null, theme: 1, revision: 1 }],
  ['extra key', { locale: null, theme: null, revision: 1, extra: true }],
  ['reverse revision', { locale: null, theme: null, revision: -1 }],
])('rejects %s acknowledgements', async (_: string, response: unknown) => {
  const repo = createSitePreferencesRepository(client({ save_site_preferences: response }, []));
  await expect(
    repo.save(defaultSitePreferences, {
      ...defaultSitePreferences,
      generation: 1,
      revision: 0,
    }),
  ).rejects.toThrow(/Invalid site preferences|Invalid preference revision|acknowledgement differs/);
});

test('rejects a mismatched acknowledgement payload', async () => {
  const repo = createSitePreferencesRepository(
    client({ save_site_preferences: { locale: 'ja', theme: 'dark', revision: 1 } }, []),
  );
  await expect(
    repo.save({ locale: 'en', theme: 'dark' }, { ...loaded, generation: 1, revision: 4 }),
  ).rejects.toThrow('acknowledgement differs');
});
