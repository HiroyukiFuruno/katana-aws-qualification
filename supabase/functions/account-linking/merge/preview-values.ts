import type { PublicTable, RawRow } from './types.ts';

export function identity(table: PublicTable, row: RawRow): string {
  const text = (name: string) => {
    const value = row[name];
    if (typeof value !== 'string' || !value) throw new Error(`merge row has invalid ${name}`);
    return value;
  };
  switch (table) {
    case 'learning_events':
      return text('event_id');
    case 'exam_sessions':
      return text('exam_id');
    case 'exam_responses':
      return `${text('exam_id')}:${text('question_key')}`;
    case 'earned_certifications':
      return text('certification_id');
    case 'assessment_answers':
      return text('assessment_id');
    case 'migration_manifests':
      return text('manifest_id');
    case 'migration_items':
      return `${text('manifest_id')}:${text('source_row_id')}`;
    case 'fundamentals_unit_progress':
      return `${text('unit_id')}:${text('content_version')}`;
    case 'fundamentals_final_sessions':
      return text('session_id');
    default:
      return table;
  }
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]),
    );
  return value;
}

export function equalPayload(left: RawRow, right: RawRow): boolean {
  const omitOwner = ({ user_id: _owner, ...row }: RawRow) => row;
  return JSON.stringify(normalize(omitOwner(left))) === JSON.stringify(normalize(omitOwner(right)));
}

export function textArray(row: RawRow, field: string): string[] {
  const value = row[field];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item))
    throw new Error(`merge row has invalid ${field}`);
  return [...new Set(value)].sort();
}

export function group<T>(values: T[], key: (value: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const value of values) {
    const groupKey = key(value);
    result.set(groupKey, [...(result.get(groupKey) ?? []), value]);
  }
  return result;
}
