import type { MigrationContext, Upload } from './migrationContext';
import { incorrectCookie, profile } from './migrationLegacy';
import { replacedCertifications } from './migrationCodec';
export async function uploadProfile(
  context: MigrationContext,
  raw: string,
  manifestId: string,
  completed: boolean,
): Promise<Upload> {
  const saved = profile(raw);
  if (!saved) {
    if (!completed) await context.reject(manifestId, 'profile', 'corrupt_profile');
    return { events: [], imported: 0, rejected: 1 };
  }
  const normalized = {
    earned: [...new Set(saved.earned.map((id) => replacedCertifications.get(id) ?? id))],
    answers: saved.answers,
  };
  if (!completed) {
    const current = await context.repository.loadProfile();
    await context.repository.write<number>('import_roadmap_profile', {
      p_manifest_id: manifestId,
      p_source_row_id: 'profile',
      p_expected_revision: current.revision,
      p_earned: normalized.earned,
      p_answers: normalized.answers,
    });
  }
  return { events: [], imported: 1, rejected: 0 };
}
export async function uploadCookie(
  context: MigrationContext,
  raw: string,
  manifestId: string,
  completed: boolean,
): Promise<Upload> {
  const ids = incorrectCookie(raw);
  const reconstructed = new Set(
    (await context.repository.loadAttempts())
      .filter((attempt) => !attempt.isCorrect)
      .map((attempt) => attempt.questionId),
  );
  if (!ids?.every((id) => reconstructed.has(id))) {
    if (!completed) await context.reject(manifestId, 'cookie', 'unreconstructed_cookie');
    return { events: [], imported: 0, rejected: 1 };
  }
  if (!completed)
    await context.repository.write<void>('accept_migration_row', {
      p_manifest_id: manifestId,
      p_source_row_id: 'cookie',
    });
  return { events: [], imported: 1, rejected: 0 };
}
