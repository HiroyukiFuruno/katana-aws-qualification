import { expect, test } from 'bun:test';
import { MemoryRepository, storage, storageKey } from './account-linking-runtime-fixture.ts';

test('termination uses the cleanup revision when normal reads are unavailable', async () => {
  class CleanupRepository extends MemoryRepository {
    async read() {
      return null;
    }
  }
  const repository = new CleanupRepository();
  const current = storage(repository);
  await current.setItem(storageKey, '{"access_token":"secret"}');
  await current.terminate();
  expect(repository.record).toBeNull();
});

test('a cleanup revision is still fenced by the subsequent delete', async () => {
  const repository = new MemoryRepository();
  const current = storage(repository);
  await current.setItem(storageKey, '{"access_token":"secret"}');
  const original = repository.readRevisionForCleanup.bind(repository);
  repository.readRevisionForCleanup = async (...arguments_) => {
    const revision = await original(...arguments_);
    if (repository.record && revision !== null)
      repository.record = { ...repository.record, revision: revision + 1 };
    return revision;
  };
  await expect(current.terminate()).rejects.toThrow('cas_conflict');
  expect(repository.record?.revision).toBe(1);
});
