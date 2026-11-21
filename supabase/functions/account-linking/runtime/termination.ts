import type { RuntimeRepository, RuntimeWriteGuard } from './types.ts';

export type TerminationAccess = {
  legId: string;
  guard: RuntimeWriteGuard;
  repository: RuntimeRepository;
  complete(): void;
  run<T>(operation: () => Promise<T>): Promise<T>;
  mutate<T>(operation: () => Promise<T>): Promise<T>;
};

export function terminateRuntime(
  access: TerminationAccess,
): Promise<'deleted' | 'missing' | 'conflict'> {
  return access.mutate(() =>
    access.run(async () => {
      const revision = await access.repository.readRevisionForCleanup(access.legId, access.guard);
      const result = await access.repository.deleteIfRevision(access.legId, revision, access.guard);
      if (result !== 'conflict') access.complete();
      return result;
    }),
  );
}
