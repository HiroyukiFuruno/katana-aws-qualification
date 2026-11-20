import { createMemberProgressRepository } from './member';
import type { LegacyAttempt } from './migrationLegacy';
import type { LegacyMigrationInput } from './migrationTypes';
import type { ImportedEvent } from './migrationVerification';
export type Upload = { events: ImportedEvent[]; imported: number; rejected: number };
export function createMigrationContext(input: LegacyMigrationInput) {
  const repository = createMemberProgressRepository(input.owner, input.client, {
    isCurrent: input.isCurrent,
  });
  return {
    input,
    repository,
    resolve: (attempt: LegacyAttempt) =>
      input.resolveQuestion(attempt.questionId, attempt.questionRevision),
    async select<T>(table: string) {
      if (!input.isCurrent()) throw new Error('Progress owner changed');
      const rows = await input.client.select<T>(table);
      if (!input.isCurrent()) throw new Error('Progress owner changed');
      return rows;
    },
    async reject(manifestId: string, rowId: string, reason: string) {
      await repository.write<void>('reject_migration_row', {
        p_manifest_id: manifestId,
        p_source_row_id: rowId,
        p_reason_code: reason,
      });
    },
  };
}
export type MigrationContext = ReturnType<typeof createMigrationContext>;
