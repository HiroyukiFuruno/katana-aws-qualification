import { expect, test } from 'bun:test';
import { aggregateDashboard } from '../src/dashboard/aggregate';
import { createMemberDashboard } from '../src/dashboard/memberRepository';
import { dashboardDefaults } from '../src/dashboard/preferences';
import type { ProgressRpcClient } from '../src/progress/types';
import { query, records } from './dashboard-fixture';

function rpcClient(
  request: (name: string, args: Record<string, unknown>) => Promise<unknown>,
): ProgressRpcClient {
  return {
    rpc: async <T>(name: string, args: Record<string, unknown>) => (await request(name, args)) as T,
    select: async () => {
      throw new Error('Dashboard must not fetch raw event tables.');
    },
  };
}

test('member dashboard uses generation-scoped summary/settings RPC and no raw table fallback', async () => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const repository = createMemberDashboard(
    rpcClient(async (name, args) => {
      calls.push({ name, args });
      if (name === 'initialize_learning_state') return 7;
      if (name === 'dashboard_summary') return aggregateDashboard(records, query);
      if (name === 'load_dashboard_settings') return { revision: 0, settings: null };
      if (name === 'save_dashboard_settings') return { revision: 1, settings: args.p_settings };
      throw new Error(`Unexpected operation ${name}`);
    }),
    () => true,
  );
  await expect(repository.summary(query)).rejects.toThrow('not ready');
  await repository.initialize();
  expect((await repository.summary(query)).total.answered).toBe(6);
  expect((await repository.settings()).revision).toBe(0);
  expect((await repository.save(dashboardDefaults('UTC'), 0)).revision).toBe(1);
  expect(calls.slice(1).every((call) => call.args.p_expected_generation === 7)).toBe(true);
});

test('member owner changes discard late summary, initialization and settings acknowledgements', async () => {
  let current = true;
  const repository = createMemberDashboard(
    rpcClient(async (name) => {
      if (name === 'initialize_learning_state') return 0;
      current = false;
      return aggregateDashboard(records, query);
    }),
    () => current,
  );
  await repository.initialize();
  await expect(repository.summary(query)).rejects.toThrow('owner changed');
  await expect(repository.settings()).rejects.toThrow('owner changed');
});

test('unexpected member settings acknowledgement is an error', async () => {
  const repository = createMemberDashboard(
    rpcClient(async (name) => {
      if (name === 'initialize_learning_state') return 0;
      return {
        revision: 1,
        settings: {
          ...dashboardDefaults('UTC'),
          filters: { ...dashboardDefaults('UTC').filters, period: '7d' },
        },
      };
    }),
    () => true,
  );
  await repository.initialize();
  await expect(repository.save(dashboardDefaults('UTC'), 0)).rejects.toThrow('acknowledgement differs');
});
