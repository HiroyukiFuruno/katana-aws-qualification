import { history } from './migrationLegacy';
import { createMigrationContext, type MigrationContext, type Upload } from './migrationContext';
import { fingerprint, stableId } from './migrationCodec';
import { inspectLegacy } from './migrationPreview';
import type {
  LegacyMigrationInput,
  LegacyMigrationReport,
  LegacyMigrationSourceReport,
  LegacyPreviewSource,
} from './migrationTypes';
import { uploadHistory } from './migrationHistoryUpload';
import { uploadDraft } from './migrationDraftUpload';
import { uploadProfile, uploadCookie } from './migrationOtherUpload';
import { verify } from './migrationVerifySource';
type ManifestRow = {
  manifest_id: string;
  source_fingerprint: string;
  status: 'started' | 'completed' | 'failed';
};
function declaredRows(source: LegacyPreviewSource) {
  if (source.sourceName !== 'history-local-storage' || source.raw === null)
    return source.rows + source.errors;
  const parsed = history(source.raw);
  return (
    parsed.errors +
    parsed.rows.filter((row) => row.mode !== 'exam' || !row.examId).length +
    new Set(parsed.rows.filter((row) => row.mode === 'exam' && row.examId).map((row) => row.examId)).size
  );
}

async function run(context: MigrationContext): Promise<LegacyMigrationReport> {
  await context.repository.initialize();
  const reports: LegacyMigrationSourceReport[] = [];
  const preview = inspectLegacy(context.input.storage);
  for (const source of preview.sources)
    try {
      reports.push(await migrate(context, source));
    } catch {
      reports.push({
        sourceName: source.sourceName,
        imported: 0,
        rejected: 0,
        failed: 1,
        removed: false,
      });
    }
  return {
    imported: reports.reduce((sum, report) => sum + report.imported, 0),
    rejected: reports.reduce((sum, report) => sum + report.rejected, 0),
    failed: reports.reduce((sum, report) => sum + report.failed, 0),
    retained: reports.filter((report) => !report.removed).length,
    sources: reports,
  };
}
async function migrate(context: MigrationContext, source: LegacyPreviewSource) {
  if (source.raw === null)
    return {
      sourceName: source.sourceName,
      imported: 0,
      rejected: source.rows + source.errors,
      failed: 0,
      removed: false,
    };
  const sourceFingerprint = await fingerprint(source.raw);
  const requestedManifest = await stableId(
    `${context.input.owner.userId}:${source.sourceName}:${source.key}:${sourceFingerprint}`,
  );
  const manifestId = await context.repository.write<string>('begin_migration', {
    p_manifest_id: requestedManifest,
    p_source_name: source.sourceName,
    p_schema_version: 1,
    p_fingerprint: sourceFingerprint,
    p_declared_rows: declaredRows(source),
  });
  const manifests = await context.select<ManifestRow[]>('migration_manifests');
  const completed = manifests.some(
    (manifest) => manifest.manifest_id === manifestId && manifest.status === 'completed',
  );
  const upload = await uploadSource(context, source, manifestId, sourceFingerprint, completed);
  if (!completed)
    await context.repository.write<void>('complete_migration', { p_manifest_id: manifestId });
  const verified = upload.rejected === 0 && (await verify(context, source, upload.events));
  const removed = verified && unchanged(context, source);
  if (removed) remove(context, source);
  return {
    sourceName: source.sourceName,
    imported: upload.imported,
    rejected: upload.rejected,
    failed: 0,
    removed,
  };
}
function unchanged(context: MigrationContext, source: LegacyPreviewSource) {
  return source.sourceName === 'wrong-cookie-v1'
    ? context.input.storage.readIncorrectCookie() === source.raw
    : context.input.storage.getItem(source.key) === source.raw;
}
function remove(context: MigrationContext, source: LegacyPreviewSource) {
  if (source.sourceName === 'wrong-cookie-v1') context.input.storage.expireIncorrectCookie();
  else context.input.storage.removeItem(source.key);
}

async function uploadSource(
  context: MigrationContext,
  source: LegacyPreviewSource,
  manifestId: string,
  sourceFingerprint: string,
  completed: boolean,
): Promise<Upload> {
  const raw = source.raw;
  if (raw === null) return { events: [], imported: 0, rejected: 1 };
  if (source.sourceName === 'history-local-storage')
    return uploadHistory(context, raw, manifestId, sourceFingerprint, completed);
  if (source.sourceName === 'profile-local-storage')
    return uploadProfile(context, raw, manifestId, completed);
  if (source.sourceName === 'exam-draft-local-storage')
    return uploadDraft(context, raw, manifestId, completed);
  return source.sourceName === 'wrong-cookie-v1' || source.sourceName === 'wrong-index-local-storage'
    ? uploadCookie(context, raw, manifestId, completed)
    : { events: [], imported: 0, rejected: 1 };
}
export function importLegacy(input: LegacyMigrationInput) {
  return run(createMigrationContext(input));
}
