import { createHash } from 'node:crypto';

export function canonicalJson(value: unknown): string {
  if (value === undefined) throw new Error('Undefined is not valid canonical JSON.');
  if (typeof value === 'number' && !Number.isFinite(value))
    throw new Error('Non-finite numbers are not valid canonical JSON.');
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value: unknown) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}
