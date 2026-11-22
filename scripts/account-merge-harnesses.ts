import { verifyCleanupHarness } from '../test/account-merge/cleanup-harness';
import { verifyExchangeHarness } from '../test/account-merge/exchange-harness';
import { verifyIntentHarness } from '../test/account-merge/intent-harness';
import { verifyLegHarness } from '../test/account-merge/leg-harness';
import { verifyLockingHarness } from '../test/account-merge/locking-harness';
import { verifyRuntimeHarness } from '../test/account-merge/runtime-harness';

export async function verifyAccountMergeHarnesses() {
  await verifyLockingHarness();
  await verifyIntentHarness();
  await verifyRuntimeHarness();
  await verifyLegHarness();
  await verifyCleanupHarness();
  await verifyExchangeHarness();
}
