import { integer, timestamp, uuid } from './codecPrimitives';
import type { LessonSummary } from './memberTypes';

export type LessonSummaryReference = { contentVersion: string; unitId: string };

const fields = new Set([
  'unitId',
  'contentVersion',
  'completedSlides',
  'totalSlides',
  'completedCheckpoints',
  'totalCheckpoints',
  'activeFinalSessionId',
  'passedAt',
  'latestScore',
  'requiredScore',
]);

function nullableInteger(value: unknown, field: string, maximum: number) {
  return value === null ? null : integer(value, field, maximum);
}

export function readLessonSummaries(raw: unknown, requested: LessonSummaryReference[]): LessonSummary[] {
  if (!Array.isArray(raw) || raw.length !== requested.length)
    throw new Error('Invalid lesson summaries');
  const requestedByKey = new Map(
    requested.map((unit) => [`${unit.unitId}\u0000${unit.contentVersion}`, unit]),
  );
  if (requestedByKey.size !== requested.length) throw new Error('Duplicate lesson summary request');
  return raw.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Invalid lesson summary');
    const row = value as Record<string, unknown>;
    if (Object.keys(row).length !== fields.size || Object.keys(row).some((field) => !fields.has(field)))
      throw new Error('Unknown lesson summary field');
    if (typeof row.unitId !== 'string' || typeof row.contentVersion !== 'string')
      throw new Error('Invalid lesson summary identity');
    const key = `${row.unitId}\u0000${row.contentVersion}`;
    if (!requestedByKey.delete(key)) throw new Error('Unexpected lesson summary');
    const totalSlides = integer(row.totalSlides, 'totalSlides');
    const totalCheckpoints = integer(row.totalCheckpoints, 'totalCheckpoints');
    const completedSlides = integer(row.completedSlides, 'completedSlides', totalSlides);
    const completedCheckpoints = integer(
      row.completedCheckpoints,
      'completedCheckpoints',
      totalCheckpoints,
    );
    const requiredScore = nullableInteger(row.requiredScore, 'requiredScore', 12);
    const latestScore = nullableInteger(row.latestScore, 'latestScore', 12);
    if (requiredScore !== null && requiredScore !== 10)
      throw new Error('The lesson summary has an unexpected passing threshold');
    if ((requiredScore === null) !== (latestScore === null))
      throw new Error('Incomplete lesson grade summary');
    return {
      unitId: row.unitId,
      contentVersion: row.contentVersion,
      completedSlides,
      totalSlides,
      completedCheckpoints,
      totalCheckpoints,
      activeFinalSessionId:
        row.activeFinalSessionId === null
          ? null
          : uuid(row.activeFinalSessionId, 'activeFinalSessionId'),
      passedAt: row.passedAt === null ? null : timestamp(row.passedAt, 'passedAt'),
      latestScore,
      requiredScore,
    };
  });
}

export function readLessonHistorySummaries(raw: unknown, current: LessonSummaryReference[]) {
  if (!Array.isArray(raw)) throw new Error('Invalid lesson history summaries');
  const references = raw.map((value): LessonSummaryReference => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Invalid lesson history summary');
    const { unitId, contentVersion } = value as Record<string, unknown>;
    if (
      typeof unitId !== 'string' ||
      !/^fundamentals\.[a-z0-9]+(?:-[a-z0-9]+)*$/.test(unitId) ||
      typeof contentVersion !== 'string' ||
      !/^[a-f0-9]{64}$/.test(contentVersion) ||
      current.some((item) => item.unitId === unitId && item.contentVersion === contentVersion)
    )
      throw new Error('Invalid lesson history summary reference');
    return { unitId, contentVersion };
  });
  return readLessonSummaries(raw, references);
}
