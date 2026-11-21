import { expect, test } from 'bun:test';
import { RuntimeStorageError } from '../supabase/functions/account-linking/runtime/pkce-storage.ts';
import { MemoryRepository, storage, storageKey } from './account-linking-runtime-fixture.ts';

class TerminalBarrierRepository extends MemoryRepository {
  readonly terminalStarted = Promise.withResolvers<void>();
  readonly terminalRelease = Promise.withResolvers<void>();
  override async isTerminal(): Promise<boolean> {
    this.terminalStarted.resolve();
    await this.terminalRelease.promise;
    return false;
  }
}

test('rechecks local termination after awaiting repository terminal state', async () => {
  const repository = new TerminalBarrierRepository();
  const current = storage(repository);
  const reading = current.getItem(storageKey);
  await repository.terminalStarted.promise;
  await current.terminate();
  repository.terminalRelease.resolve();
  await expect(reading).rejects.toThrow(RuntimeStorageError);
});
