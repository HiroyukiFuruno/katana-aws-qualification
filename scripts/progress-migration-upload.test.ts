import { expect, test } from 'bun:test';
import { importLegacy, type LegacyStorage, type ProgressRpcClient } from '../src/progress';
import type { MigrationContext } from '../src/progress/migrationContext';
import { uploadCookie, uploadProfile } from '../src/progress/migrationOtherUpload';

test('profile upload uses the atomic import RPC with the current revision', async () => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const context = {
    repository: {
      async loadProfile() {
        return { profile: { answers: {}, earned: [] }, revision: 4 };
      },
      async write<T>(name: string, args: Record<string, unknown>) {
        calls.push({ name, args });
        return 5 as T;
      },
    },
  } as unknown as MigrationContext;
  const result = await uploadProfile(
    context,
    JSON.stringify({ answers: { assessment: 1 }, earned: ['dva-c02'] }),
    'manifest',
    false,
  );
  expect(result).toEqual({ events: [], imported: 1, rejected: 0 });
  expect(calls).toEqual([
    {
      name: 'import_roadmap_profile_v2',
      args: {
        p_answers: { assessment: 1 },
        p_earned: ['dva-c03'],
        p_expected_revision: 4,
        p_manifest_id: 'manifest',
        p_presentation: { optionOrders: {}, order: [] },
        p_source_row_id: 'profile',
      },
    },
  ]);
});

test('manifest requests differ when equal raw values belong to different source keys', async () => {
  const values = new Map([
    ['saa-study.exam.v1', '{'],
    ['katana.certification-exam.v1.saa-c03', '{'],
  ]);
  const storage: LegacyStorage = {
    expireIncorrectCookie: () => {},
    getItem: (key) => values.get(key) ?? null,
    keys: () => [...values.keys()],
    readIncorrectCookie: () => null,
    removeItem: () => {},
  };
  const manifests: string[] = [];
  const client: ProgressRpcClient = {
    async rpc(name, args) {
      if (name === 'initialize_learning_state') return 0;
      if (name === 'begin_migration') {
        manifests.push(args.p_manifest_id as string);
        return args.p_manifest_id as string;
      }
      return undefined;
    },
    async select() {
      return [];
    },
  };
  await importLegacy({
    client,
    isCurrent: () => true,
    owner: { kind: 'member', generation: 1, userId: '00000000-0000-0000-0000-000000000001' },
    resolveQuestion: async () => undefined,
    storage,
  });
  expect(manifests).toHaveLength(2);
  expect(new Set(manifests).size).toBe(2);
});

test('cookie rows are accepted only when every historical incorrect ID exists remotely', async () => {
  const rejected: string[] = [];
  const incomplete = {
    reject: async (_manifest: string, _row: string, reason: string) => void rejected.push(reason),
    repository: {
      async loadAttempts() {
        return [{ isCorrect: false, questionId: 'q-1' }];
      },
      async write() {
        throw new Error('incomplete cookie must not be accepted');
      },
    },
  } as unknown as MigrationContext;
  for (const raw of [JSON.stringify(['q-1', 'missing']), 'q-1,q-2']) {
    expect(await uploadCookie(incomplete, raw, 'manifest', false)).toEqual({
      events: [],
      imported: 0,
      rejected: 1,
    });
  }
  expect(rejected).toEqual(['unreconstructed_cookie', 'unreconstructed_cookie']);
  const accepted: { name?: string } = {};
  const complete = {
    reject: async () => {},
    repository: {
      async loadAttempts() {
        return [{ isCorrect: false, questionId: 'q-1' }];
      },
      async write(name: string) {
        accepted.name = name;
      },
    },
  } as unknown as MigrationContext;
  expect(await uploadCookie(complete, JSON.stringify(['q-1']), 'manifest', false)).toEqual({
    events: [],
    imported: 1,
    rejected: 0,
  });
  expect(accepted.name).toBe('accept_migration_row');
});
