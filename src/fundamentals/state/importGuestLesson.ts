import { guestLessonPrefix } from '../../learningStorage';
import { withHistoryLock } from '../../historyLock';
import { canPersistGuestProgress } from '../../progress/guest';
import { fingerprint, stableId } from '../../progress/migrationCodec';
import { readLessonSnapshot } from './snapshotCodec';
import { verifiesImportedEvents } from './importEvents';
import { guestLessonImportWire } from './importWire';
import { verifiesImportedGuestLesson } from './importReceipt';
import { readGuestLessonSource } from './guestSourceCodec';
import type { GuestLessonImport, LessonImportResult, LessonMigrationInput } from './importTypes';

const sourceName = 'fundamentals-progress-local-storage';

type Manifest = { manifest_id: string; source_fingerprint: string; source_name: string; status: string };

function current(input: LessonMigrationInput) {
  if (!input.access.isCurrent()) throw new Error('Lesson migration owner changed.');
}

function sourceKey(input: LessonMigrationInput) {
  return `${guestLessonPrefix}${input.asset.unit.id}.${input.asset.contentVersion}`;
}

export function readGuestLessonImport(input: LessonMigrationInput): GuestLessonImport | null {
  current(input);
  if (!canPersistGuestProgress(input.storage)) return null;
  const key = sourceKey(input);
  const raw = input.storage.getItem(key);
  if (raw === null) return null;
  return { asset: input.asset, key, raw, source: readGuestLessonSource(JSON.parse(raw), input.asset) };
}

async function generation(input: LessonMigrationInput) {
  current(input);
  const value = await input.access.client.rpc<unknown>('initialize_learning_state', {});
  current(input);
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error('Invalid lesson migration generation.');
  }
  return value;
}

async function verifiedManifest(input: LessonMigrationInput, manifestId: string, sourceHash: string) {
  current(input);
  const manifests = await input.access.client.select<Manifest[]>('migration_manifests');
  current(input);
  return manifests.some(
    (item) =>
      item.manifest_id === manifestId &&
      item.source_name === sourceName &&
      item.source_fingerprint === sourceHash &&
      item.status === 'completed',
  );
}

export async function importGuestLesson(input: LessonMigrationInput): Promise<LessonImportResult> {
  const imported = readGuestLessonImport(input);
  if (!imported) throw new Error('No consented guest lesson data is available.');
  const sourceHash = await fingerprint(imported.raw);
  current(input);
  const serverGeneration = await generation(input);
  const requestedManifest = await stableId(
    `${input.access.owner.userId}:${sourceName}:${imported.key}:${sourceHash}`,
  );
  current(input);
  const manifestId = await input.access.client.rpc<string>('begin_migration', {
    p_declared_rows: 1,
    p_expected_generation: serverGeneration,
    p_fingerprint: sourceHash,
    p_manifest_id: requestedManifest,
    p_schema_version: 1,
    p_source_name: sourceName,
  });
  current(input);
  const snapshot = readLessonSnapshot(
    await input.access.client.rpc<unknown>('import_fundamentals_unit', {
      p_expected_generation: serverGeneration,
      p_manifest_id: manifestId,
      p_payload: guestLessonImportWire(imported.source),
      p_source_row_id: `${imported.source.unitId}:${imported.source.contentVersion}`,
    }),
    input.asset,
  );
  current(input);
  if (!verifiesImportedGuestLesson(snapshot, imported.source, input.asset)) {
    throw new Error('Lesson migration snapshot did not retain the source receipts.');
  }
  if (!(await verifiesImportedEvents(input.access.client, imported.source, input.asset))) {
    throw new Error('Lesson migration event receipts were not confirmed.');
  }
  current(input);
  await input.access.client.rpc<void>('complete_migration', {
    p_expected_generation: serverGeneration,
    p_manifest_id: manifestId,
  });
  current(input);
  if ((await generation(input)) !== serverGeneration) {
    throw new Error('Lesson migration generation changed.');
  }
  if (!(await verifiedManifest(input, manifestId, sourceHash))) {
    throw new Error('Lesson migration receipt was not confirmed.');
  }
  await input.access.refresh();
  current(input);
  const removed = await withHistoryLock(async () => {
    current(input);
    if (
      !canPersistGuestProgress(input.storage) ||
      input.storage.getItem(imported.key) !== imported.raw
    ) {
      return false;
    }
    if ((await generation(input)) !== serverGeneration)
      throw new Error('Lesson migration generation changed.');
    current(input);
    if (
      !canPersistGuestProgress(input.storage) ||
      input.storage.getItem(imported.key) !== imported.raw
    ) {
      return false;
    }
    input.storage.removeItem(imported.key);
    if (input.storage.getItem(imported.key) !== null)
      throw new Error('Lesson migration removal was not confirmed.');
    return true;
  });
  return { manifestId, removed, snapshot };
}
