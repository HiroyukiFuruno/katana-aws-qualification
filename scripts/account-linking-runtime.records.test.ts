import { expect, test } from 'bun:test';
import { RuntimeStorageError } from '../supabase/functions/account-linking/runtime/pkce-storage.ts';
import { MemoryRepository, storage, storageKey } from './account-linking-runtime-fixture.ts';

function fixture() {
  const repository = new MemoryRepository();
  return { repository, storage: storage(repository) };
}

test('rejects session arrays, unknown slots, invalid revision and key version', async () => {
  const current = fixture();
  await expect(current.storage.setItem(storageKey, '[]')).rejects.toThrow(RuntimeStorageError);
  await expect(current.storage.setItem('unexpected', '[]')).rejects.toThrow(RuntimeStorageError);
  await current.storage.setItem(storageKey, '{"access_token":"a"}');
  if (!current.repository.record) throw new Error('expected record');
  current.repository.record.revision = -1;
  await expect(current.storage.getItem(storageKey)).rejects.toThrow(RuntimeStorageError);
  const next = fixture();
  await next.storage.setItem(storageKey, '{"access_token":"a"}');
  if (!next.repository.record) throw new Error('expected record');
  next.repository.record.keyVersion = 'not allowed!';
  await expect(next.storage.getItem(storageKey)).rejects.toThrow(RuntimeStorageError);
});
