export type FrameState = 'pending' | 'applied';
export type Preflight = { fingerprint: string; state: FrameState };

const retryable = new Set(['40001', '55P03', 'PT409']);

function errorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

export async function applyWithRecovery(
  preflight: () => Promise<Preflight>,
  execute: (fingerprint: string) => Promise<void>,
) {
  const before = await preflight();
  if (before.state === 'applied') return 'noop' as const;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await execute(before.fingerprint);
    } catch (error) {
      const after = await preflight();
      if (after.state === 'applied' && after.fingerprint === before.fingerprint)
        return 'recovered' as const;
      const code = errorCode(error);
      if (!code || retryable.has(code)) continue;
      throw error;
    }
    const after = await preflight();
    if (after.state === 'applied' && after.fingerprint === before.fingerprint) return 'applied' as const;
    throw new Error('Apply completed without the expected ledger and contract fingerprint');
  }
  throw new Error('Apply did not reach the recorded postcondition');
}
