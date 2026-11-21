import { expect, test } from 'bun:test';
import { RuntimeStorageError } from '../supabase/functions/account-linking/runtime/pkce-storage.ts';
import {
  BarrierRepository,
  gate,
  nonce,
  nonceHash,
  storageWithCrypto,
} from './account-linking-runtime.envelope-barriers.ts';
import { storageKey } from './account-linking-runtime-fixture.ts';

class FinalTerminalRepository extends BarrierRepository {
  calls = 0;
  pauseAt = Number.POSITIVE_INFINITY;
  final = gate();
  override async isTerminal(): Promise<boolean> {
    this.calls += 1;
    if (this.calls === this.pauseAt) await this.final.pause();
    return false;
  }
}

class DeleteBarrierRepository extends BarrierRepository {
  deleted = gate();
  override async deleteIfRevision(...args: Parameters<BarrierRepository['deleteIfRevision']>) {
    await this.deleted.pause();
    return super.deleteIfRevision(...args);
  }
}

test('a local terminate during final liveness wait cannot return the captured nonce', async () => {
  const repository = new FinalTerminalRepository();
  const client = storageWithCrypto(repository, globalThis.crypto);
  const expected = await nonceHash();
  await client.initialize(nonce, expected);
  repository.pauseAt = repository.calls + 6;
  const pending = client.getIngestNonce(expected);
  await repository.final.entered;
  await client.terminate();
  repository.final.release();
  const result = await pending.then(
    () => undefined,
    (error) => error,
  );
  expect(result).toBeInstanceOf(RuntimeStorageError);
  expect((result as RuntimeStorageError).code).toBe('terminal');
});

test('queued SDK write observes terminal state before the FIFO advances', async () => {
  const repository = new DeleteBarrierRepository();
  const client = storageWithCrypto(repository, globalThis.crypto);
  await client.initialize(nonce, await nonceHash());
  const terminating = client.terminate();
  await repository.deleted.entered;
  const queued = client.setItem(storageKey, '{"access_token":"session-secret"}');
  repository.deleted.release();
  await terminating;
  const result = await queued.then(
    () => undefined,
    (error) => error,
  );
  expect(result).toBeInstanceOf(RuntimeStorageError);
  expect((result as RuntimeStorageError).code).toBe('terminal');
  expect(repository.record).toBeNull();
});

test('copyHash cannot leak a throwing Uint8Array slice override', async () => {
  let calls = 0;
  class SliceTrap extends Uint8Array {
    override slice(start?: number, end?: number): Uint8Array {
      void start;
      void end;
      calls += 1;
      throw new Error('raw-hash-secret');
    }
  }
  const client = storageWithCrypto(new BarrierRepository(), globalThis.crypto);
  await client.initialize(nonce, await nonceHash());
  const expected = new SliceTrap(await nonceHash());
  expect(await client.getIngestNonce(expected)).toBe(nonce);
  expect(calls).toBe(0);
});

test('copyHash sanitizes a throwing typed-array length getter', async () => {
  const client = storageWithCrypto(new BarrierRepository(), globalThis.crypto);
  const expected = await nonceHash();
  Object.defineProperty(expected, 'length', {
    get() {
      throw new Error('raw-hash-secret');
    },
  });
  const result = await client.getIngestNonce(expected).then(
    () => undefined,
    (error) => error,
  );
  expect(result).toBeInstanceOf(RuntimeStorageError);
  expect((result as RuntimeStorageError).code).toBe('nonce_mismatch');
  expect((result as Error).message).not.toContain('raw-hash-secret');
});
