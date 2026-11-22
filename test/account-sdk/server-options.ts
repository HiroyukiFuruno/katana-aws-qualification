import type { IntentKind } from './control-fixture';
import type { ProofRacePort } from './proof-port';

export const callback = 'http://127.0.0.1:54533/test/account-sdk/callback.html';
export type AdapterOptions = {
  authorizationFailure?: boolean;
  cleanupReceiptFilename?: string;
  beforeProofAccept?: (port: ProofRacePort) => Promise<void>;
  dropProofResponse?: boolean;
  intentKind?: IntentKind;
  targetProvider?: 'keycloak' | 'azure';
  targetExisting?: boolean;
  targetSameOwner?: boolean;
};
