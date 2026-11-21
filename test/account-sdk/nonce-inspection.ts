import { RuntimeStorageError } from '../../supabase/functions/account-linking/runtime/types.ts';
import type { ServerSdkLeg } from '../../supabase/functions/account-linking/server/sdk-worker.types.ts';
import type { Operation } from './control-fixture';
import { storage } from './runtime';

export async function assertAcceptedNonceRemoved(
  operation: Operation,
  current: ServerSdkLeg,
  allowRetainedNonce = false,
) {
  if (current.state !== 'proved') return false;
  try {
    await storage(operation.actor, current).getIngestNonce(current.nonceHash);
  } catch (error) {
    if (error instanceof RuntimeStorageError && error.code === 'nonce_missing') return true;
    throw error;
  }
  if (allowRetainedNonce) return false;
  throw new Error('Accepted proof retained its ingest nonce');
}
