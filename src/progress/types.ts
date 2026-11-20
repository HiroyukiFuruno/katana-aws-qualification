import type { AuthState } from '../auth/types';

export type GuestProgressOwner = { kind: 'guest'; generation: number };
export type MemberProgressOwner = { kind: 'member'; generation: number; userId: string };
export type ProgressOwner = GuestProgressOwner | MemberProgressOwner;

export function matchesAuthOwner(auth: AuthState, owner: ProgressOwner) {
  return owner.kind === 'member'
    ? auth.status === 'ready' && auth.account?.id === owner.userId
    : auth.status === 'unavailable' || (auth.status === 'ready' && !auth.account);
}

export type ProgressAccess =
  | { state: 'ready'; owner: ProgressOwner }
  | { state: 'blocked'; reason: 'auth-loading' }
  | { state: 'failed'; reason: 'auth-error' };

export type ProgressAuthSnapshot =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'guest'; generation: number }
  | { state: 'member'; generation: number; userId: string };

export function progressAccess(snapshot: ProgressAuthSnapshot): ProgressAccess {
  if (snapshot.state === 'loading') return { state: 'blocked', reason: 'auth-loading' };
  if (snapshot.state === 'error') return { state: 'failed', reason: 'auth-error' };
  if (snapshot.state === 'guest') {
    return { state: 'ready', owner: { kind: 'guest', generation: snapshot.generation } };
  }
  return {
    state: 'ready',
    owner: { kind: 'member', generation: snapshot.generation, userId: snapshot.userId },
  };
}

export function sameProgressOwner(left: ProgressOwner, right: ProgressOwner) {
  return (
    left.kind === right.kind &&
    left.generation === right.generation &&
    (left.kind === 'guest' || left.userId === (right as MemberProgressOwner).userId)
  );
}

export type ProgressRpcClient = {
  rpc<T>(name: string, args: Record<string, unknown>): Promise<T>;
  select<T>(table: string, filters?: Record<string, string>): Promise<T>;
};

export class ProgressOwnerChangedError extends Error {
  constructor() {
    super('Progress owner changed while an operation was pending.');
    this.name = 'ProgressOwnerChangedError';
  }
}

export type ProgressOperation = {
  isCurrent: () => boolean;
};

export function assertCurrentProgressOwner(operation: ProgressOperation) {
  if (!operation.isCurrent()) throw new ProgressOwnerChangedError();
}
