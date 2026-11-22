import { expect, test } from 'bun:test';
import { readMilestone, readMilestones, validateMilestoneInput } from '../src/milestones/codec';
import { createMilestonesRepository } from '../src/milestones/repository';
import type { ProgressRpcClient } from '../src/progress/types';

const input = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  certificationId: 'saa-c03',
  kind: 'study' as const,
  title: 'Study',
  plannedOn: '2026-12-01',
  plannedAt: null,
  completed: false,
};
const row = { ...input, revision: 0 };

test('sends exact RPC parameters and validates acknowledgement', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client: ProgressRpcClient = {
    async rpc<T>(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return row as T;
    },
    async select<T>() {
      return [] as T;
    },
  };
  const repository = createMilestonesRepository(client);
  await expect(repository.save(input, null, 7)).resolves.toEqual(row);
  expect(calls[0]).toEqual({
    name: 'save_certification_milestone',
    args: {
      p_id: input.id,
      p_certification_id: 'saa-c03',
      p_kind: 'study',
      p_title: 'Study',
      p_planned_on: '2026-12-01',
      p_planned_at: null,
      p_completed: false,
      p_expected_revision: null,
      p_expected_generation: 7,
    },
  });
});

test('rejects malformed rows, reverse revisions, and non-true delete acknowledgements', async () => {
  expect(() => readMilestone({ ...row, extra: true })).toThrow();
  const bad: ProgressRpcClient = {
    async rpc<T>(name: string) {
      return (name === 'save_certification_milestone' ? { ...row, revision: -1 } : false) as T;
    },
    async select<T>() {
      return [] as T;
    },
  };
  const repository = createMilestonesRepository(bad);
  await expect(repository.save(input, 2, 7)).rejects.toThrow();
  await expect(repository.remove(input.id, 0, 7)).rejects.toThrow();
});

test('uses catalog ids, codepoint title length, and rejects duplicate rows', () => {
  const astral = '🗡'.repeat(120);
  expect(validateMilestoneInput({ ...input, title: astral })).toMatchObject({ title: astral });
  expect(() => validateMilestoneInput({ ...input, title: `${astral}a` })).toThrow();
  expect(() => validateMilestoneInput({ ...input, certificationId: 'unknown' })).toThrow();
  expect(() => readMilestones([row, row])).toThrow('Duplicate milestone id');
  expect(() => readMilestone({ ...row, plannedAt: '2026-02-01T00:00' })).toThrow();
  expect(() => readMilestone({ ...row, plannedAt: '2026-02-30T00:00:00Z', plannedOn: null })).toThrow();
});
