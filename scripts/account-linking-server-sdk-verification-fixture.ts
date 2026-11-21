import { ServerSdkWorker } from '../supabase/functions/account-linking/server/sdk-worker.ts';
import { harness, leg, prime, session } from './account-linking-server-sdk.boundary-fixture.ts';

export type VerificationMode =
  | 'healthy'
  | 'unavailable'
  | 'network'
  | 'rateLimited'
  | 'requestTimeout'
  | 'invalid'
  | 'mismatch';

export async function verificationFixture(restored = true) {
  const subject = harness(leg({ state: restored ? 'exchanging' : 'issued' }));
  await prime(subject);
  const storage = subject.storageFor(subject.current);
  if (restored) await storage.setItem(subject.current.runtime.storageKey, JSON.stringify(session()));
  else
    await storage.setItem(
      `${subject.current.runtime.storageKey}-code-verifier`,
      JSON.stringify('native-verifier'),
    );
  let mode: VerificationMode = 'healthy';
  let failPromotion = false;
  const failures: boolean[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    if (!String(input).endsWith('/user') || mode === 'healthy') return subject.fetch(input, init);
    subject.calls.getUser += 1;
    if (mode === 'network') throw new TypeError('private network failure access-secret');
    if (mode === 'mismatch') return Response.json({ id: 'other-user' });
    return Response.json(
      { message: 'private verification failure access-secret', code: 'unexpected_failure' },
      {
        status:
          mode === 'unavailable'
            ? 503
            : mode === 'rateLimited'
              ? 429
              : mode === 'requestTimeout'
                ? 408
                : 401,
      },
    );
  };
  const promote = subject.control.promote;
  subject.control.promote = async (current) => {
    const result = await promote(current);
    if (failPromotion) {
      failPromotion = false;
      mode = 'unavailable';
      throw new Error('private promotion reply unavailable');
    }
    subject.current = { ...current, state: 'exchanged' };
    return result;
  };
  subject.control.claimExchange = async (current) => {
    subject.current = { ...current, state: 'exchanging', revision: current.revision + 1 };
    return { claimed: true, leg: subject.current };
  };
  subject.control.failExchange = async (current, unknown) => {
    failures.push(unknown);
    subject.current = { ...current, state: unknown ? 'exchange_unknown' : 'failed' };
    return { legId: current.id, state: subject.current.state, expiresAt: current.expiresAt };
  };
  return {
    subject,
    failures,
    storage,
    setMode(value: VerificationMode) {
      mode = value;
    },
    failPromotionOnce() {
      failPromotion = true;
    },
    worker: new ServerSdkWorker({
      control: subject.control,
      storage: subject.storageFor,
      url: 'https://auth.example',
      key: 'anon-key',
      providers: { github: { callback: 'https://app.example/callback', scopes: 'read:user' } },
      fetch: fetcher,
    }),
  };
}
