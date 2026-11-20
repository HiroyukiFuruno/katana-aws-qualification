import type { MigrationContext } from './migrationContext';
import { draft, incorrectCookie, profile } from './migrationLegacy';
import type { LegacyPreviewSource } from './migrationTypes';
import { hasImportedDraft, hasImportedEvents, type ImportedEvent } from './migrationVerification';
import { replacedCertifications, sameStrings } from './migrationCodec';
export async function verify(
  context: MigrationContext,
  source: LegacyPreviewSource,
  expected: readonly ImportedEvent[],
) {
  const raw = source.raw;
  if (raw === null) return false;
  if (source.sourceName === 'profile-local-storage') {
    const saved = profile(raw);
    const remote = await context.repository.loadProfile();
    return (
      !!saved &&
      sameStrings(
        [...new Set(saved.earned.map((id) => replacedCertifications.get(id) ?? id))],
        remote.profile.earned,
      ) &&
      JSON.stringify(Object.entries(saved.answers).sort()) ===
        JSON.stringify(Object.entries(remote.profile.answers).sort())
    );
  }
  if (source.sourceName === 'exam-draft-local-storage') {
    const saved = draft(raw);
    return (
      !!saved &&
      hasImportedDraft(
        saved,
        await context.select<
          {
            exam_id: string;
            deadline_at: string;
            position: number;
            question_order: { question_id: string; question_revision: number }[];
            state: string;
          }[]
        >('exam_sessions'),
        await context.select<
          {
            exam_id: string;
            question_key: string;
            selected: string[];
            flagged: boolean;
            duration_ms: number;
            selected_at: string | null;
          }[]
        >('exam_responses'),
      )
    );
  }
  if (source.sourceName === 'wrong-cookie-v1' || source.sourceName === 'wrong-index-local-storage') {
    const ids = incorrectCookie(raw);
    const reconstructed = new Set(
      (await context.repository.loadAttempts())
        .filter((attempt) => !attempt.isCorrect)
        .map((attempt) => attempt.questionId),
    );
    return !!ids && ids.every((id) => reconstructed.has(id));
  }
  return hasImportedEvents(await context.repository.loadAttempts(), expected);
}
