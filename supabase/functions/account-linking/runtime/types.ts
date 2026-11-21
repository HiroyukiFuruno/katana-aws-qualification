export type RuntimePurpose = 'leg' | 'proof';

export type RuntimeContext = {
  purpose: RuntimePurpose;
  intentId: string;
  legId: string;
  attempt: number;
  storageKey: string;
  issuedAt: number;
  expiresAt: number;
};

export type RuntimeWriteGuard = Pick<
  RuntimeContext,
  'purpose' | 'intentId' | 'legId' | 'attempt' | 'storageKey' | 'issuedAt' | 'expiresAt'
>;

export type RuntimeRecord = {
  revision: number;
  keyVersion: string;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
  expiresAt: number;
};

export type RuntimeRepository = {
  read(legId: string): Promise<RuntimeRecord | null>;
  /** DB 実装は revision、正規 phase/発行時刻/期限、active 状態を DB 時刻で同一 TX に照合する。 */
  compareAndSwap(
    legId: string,
    revision: number | null,
    next: RuntimeRecord,
    guard: RuntimeWriteGuard,
  ): Promise<boolean>;
  /** active/期限切れは要求しないが、正規phase/contextとrevisionを同一TXで照合する。 */
  deleteIfRevision(
    legId: string,
    revision: number | null,
    guard: RuntimeWriteGuard,
  ): Promise<'deleted' | 'missing' | 'conflict'>;
  isTerminal(legId: string): Promise<boolean>;
};

export type RuntimeKeyring = {
  active(): Promise<{ version: string; bytes: Uint8Array }>;
  resolve(version: string): Promise<Uint8Array | null>;
};

export type RuntimeClock = { now(): number };

export type RuntimeStorageOptions = {
  repository: RuntimeRepository;
  keyring: RuntimeKeyring;
  crypto: Crypto;
  clock: RuntimeClock;
  context: RuntimeContext;
};

export type RuntimeStorageFailure =
  | 'cas_conflict'
  | 'decrypt_failed'
  | 'expired'
  | 'invalid_context'
  | 'invalid_key'
  | 'invalid_storage_key'
  | 'malformed_value'
  | 'repository_failed'
  | 'terminal'
  | 'unknown_key';

export class RuntimeStorageError extends Error {
  constructor(readonly code: RuntimeStorageFailure) {
    super(`account-linking runtime storage: ${code}`);
    this.name = 'RuntimeStorageError';
  }
}
