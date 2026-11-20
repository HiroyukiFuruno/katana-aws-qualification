import { legacyRows } from './migrationLegacy';
import type {
  LegacyMigrationPreview,
  LegacyPreviewSource,
  LegacySourceName,
  LegacyStorage,
} from './migrationTypes';

const historyKey = 'saa-study.attempts.v1';
const wrongIndexKey = 'saa-study.incorrect.v1';
const profileKey = 'katana.certification-profile.v1';
const legacyExamKey = 'saa-study.exam.v1';
const examPrefix = 'katana.certification-exam.v1.';

function previewSource(storage: LegacyStorage, sourceName: LegacySourceName, key: string) {
  try {
    const raw = storage.getItem(key);
    return raw === null ? undefined : { sourceName, key, raw, ...legacyRows(sourceName, raw) };
  } catch {
    return { sourceName, key, raw: null, rows: 0, errors: 1 };
  }
}

export function inspectLegacy(storage: LegacyStorage): LegacyMigrationPreview {
  const sources: LegacyPreviewSource[] = [];
  for (const [sourceName, key] of [
    ['history-local-storage', historyKey],
    ['wrong-index-local-storage', wrongIndexKey],
    ['profile-local-storage', profileKey],
    ['exam-draft-local-storage', legacyExamKey],
  ] as const) {
    const source = previewSource(storage, sourceName, key);
    if (source) sources.push(source);
  }
  try {
    for (const key of storage.keys()) {
      if (!key.startsWith(examPrefix)) continue;
      const source = previewSource(storage, 'exam-draft-local-storage', key);
      if (source) sources.push(source);
    }
  } catch {
    sources.push({
      sourceName: 'exam-draft-local-storage',
      key: examPrefix,
      raw: null,
      rows: 0,
      errors: 1,
    });
  }
  try {
    const raw = storage.readIncorrectCookie();
    if (raw !== null)
      sources.push({
        sourceName: 'wrong-cookie-v1',
        key: 'saa_study_incorrect_v1',
        raw,
        rows: 1,
        errors: 0,
      });
  } catch {
    sources.push({
      sourceName: 'wrong-cookie-v1',
      key: 'saa_study_incorrect_v1',
      raw: null,
      rows: 0,
      errors: 1,
    });
  }
  return {
    sources,
    errors: sources.reduce((sum, source) => sum + source.errors, 0),
    rows: sources.reduce((sum, source) => sum + source.rows, 0),
  };
}
