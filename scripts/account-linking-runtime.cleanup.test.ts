import { expect, test } from 'bun:test';
import type { RuntimeWriteGuard } from '../supabase/functions/account-linking/runtime/types.ts';
import { context, MemoryRepository, storage, storageKey } from './account-linking-runtime-fixture.ts';

test('cleanup binds its original phase and preserves a newer proof record', async () => {
  const proof = context({ purpose: 'proof', expiresAt: context().issuedAt + 600_000 });
  class PhaseRepository extends MemoryRepository {
    async deleteIfRevision(id: string, revision: number | null, guard?: RuntimeWriteGuard) {
      const matches = Object.entries(proof).every(
        ([key, value]) => guard?.[key as keyof RuntimeWriteGuard] === value,
      );
      if (!matches) return 'conflict' as const;
      return super.deleteIfRevision(id, revision);
    }
  }
  const repository = new PhaseRepository();
  const oldLeg = storage(repository);
  const confirmed = storage(repository, { context: proof });
  await confirmed.setItem(storageKey, '{"access_token":"proof-session"}');
  const record = repository.record;
  await expect(oldLeg.terminate()).rejects.toThrow('cas_conflict');
  expect(repository.record).toBe(record);
  await confirmed.terminate();
  expect(repository.record).toBeNull();
});
