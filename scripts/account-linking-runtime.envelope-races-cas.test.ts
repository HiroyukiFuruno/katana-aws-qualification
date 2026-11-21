import { expect, test } from 'bun:test';
import { context, now } from './account-linking-runtime-fixture.ts';
import {
  BarrierRepository,
  fixedFailure,
  gate,
  nonce,
  nonceHash,
  storageWithCrypto,
} from './account-linking-runtime.envelope-barriers.ts';

for (const terminal of [false, true]) {
  const code = terminal ? 'terminal' : 'expired';
  test(`SDK set after accepted CAS returns fixed ${code} without session exposure`, async () => {
    const repository = new BarrierRepository();
    const runtime = context();
    let timestamp = now;
    const client = storageWithCrypto(repository, globalThis.crypto, runtime, () => timestamp);
    await client.initialize(nonce, await nonceHash());
    const paused = gate();
    repository.casBarrier = paused;
    const pending = client.setItem(runtime.storageKey, '{"access_token":"session-secret"}');
    await paused.entered;
    if (terminal) repository.terminal = true;
    else timestamp = runtime.expiresAt;
    paused.release();
    const error = await fixedFailure(pending);
    expect(error.code).toBe(code);
    expect(error.message).not.toContain('session-secret');
    expect(repository.record?.revision).toBe(1);
  });
}
