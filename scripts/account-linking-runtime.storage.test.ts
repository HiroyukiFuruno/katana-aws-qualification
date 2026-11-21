import { expect, test } from 'bun:test';
import {
  RuntimeStorageError,
  type RuntimeRecord,
} from '../supabase/functions/account-linking/runtime/pkce-storage.ts';
import { MemoryRepository, keyring, storage, storageKey } from './account-linking-runtime-fixture.ts';

class BarrierRepository extends MemoryRepository {
  private reads = 0;
  private readonly barrier = Promise.withResolvers<void>();
  constructor(private readonly coordinateReads = false) {
    super();
  }
  override async read(): Promise<RuntimeRecord | null> {
    if (this.coordinateReads && ++this.reads <= 2) {
      if (this.reads === 2) this.barrier.resolve();
      await this.barrier.promise;
    }
    return super.read();
  }
}

function client(repository: MemoryRepository) {
  return storage(repository, { keyring: keyring('v2', 2) });
}

test('admits only known AuthJS storage keys and deletes a terminal blob by CAS', async () => {
  const repository = new BarrierRepository();
  const current = client(repository);
  await expect(current.setItem(`${storageKey}-flow-short-code-verifier`, '"verifier"')).rejects.toThrow(
    RuntimeStorageError,
  );
  await current.setItem(`${storageKey}-flow-AbCd1234-code-verifier`, '"verifier"');
  await current.setItem(`${storageKey}-flows-code-verifier`, '["AbCd1234"]');
  await current.setItem(`${storageKey}-code-verifier`, '"verifier"');
  await current.setItem(`${storageKey}-user`, '{"user":{"id":"u"}}');
  await current.terminate();
  await expect(current.getItem(storageKey)).rejects.toThrow(RuntimeStorageError);
});

test('returns a conflict rather than overwriting an equal-revision concurrent write', async () => {
  const repository = new BarrierRepository(true);
  const result = await Promise.allSettled([
    client(repository).setItem(`${storageKey}-code-verifier`, '"one"'),
    client(repository).setItem(`${storageKey}-code-verifier`, '"two"'),
  ]);
  expect(result.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
  expect(result.filter((entry) => entry.status === 'rejected')).toHaveLength(1);
});
