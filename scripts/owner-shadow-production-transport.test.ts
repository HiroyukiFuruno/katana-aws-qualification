import { expect, test } from 'bun:test';
import { parseProductionArgs } from './owner-shadow-production-options';
import { applyWithRecovery } from './owner-shadow-production-transport';

test('refuses apply unless the verified source hash is explicit', () => {
  expect(() => parseProductionArgs(['--apply'])).toThrow('verified source SHA');
  expect(() => parseProductionArgs(['--apply', 'bad'])).toThrow('verified source SHA');
  expect(parseProductionArgs([])).toEqual({ apply: false });
  expect(parseProductionArgs(['--apply', 'a'.repeat(64)])).toEqual({
    apply: true,
    sourceHash: 'a'.repeat(64),
  });
});

test('re-reads committed state after an unknown transport outcome', async () => {
  let committed = false;
  let calls = 0;
  const result = await applyWithRecovery(
    async () => ({ fingerprint: 'a'.repeat(64), state: committed ? 'applied' : 'pending' }),
    async () => {
      calls++;
      committed = true;
      throw new Error('connection closed after commit');
    },
  );
  expect(result).toBe('recovered');
  expect(calls).toBe(1);
});

test('retries only known serialization, lock, and shadow-retry failures', async () => {
  let calls = 0;
  const result = await applyWithRecovery(
    async () => ({ fingerprint: 'b'.repeat(64), state: calls > 1 ? 'applied' : 'pending' }),
    async () => {
      calls++;
      if (calls === 1) throw Object.assign(new Error('serialization'), { code: '40001' });
    },
  );
  expect(result).toBe('applied');
  expect(calls).toBe(2);
  await expect(
    applyWithRecovery(
      async () => ({ fingerprint: 'c'.repeat(64), state: 'pending' }),
      async () => {
        throw Object.assign(new Error('invalid'), { code: 'PT400' });
      },
    ),
  ).rejects.toThrow('invalid');
});
