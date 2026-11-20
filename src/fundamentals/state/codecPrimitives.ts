export function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid lesson object: ${field}`);
  }
  return value as Record<string, unknown>;
}

export function exactFields(value: Record<string, unknown>, fields: readonly string[]) {
  if (Object.keys(value).length !== fields.length || fields.some((field) => !(field in value))) {
    throw new Error('Unknown or missing guest lesson source field.');
  }
}

export function text(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.length) throw new Error(`Invalid lesson text: ${field}`);
  return value;
}

export function integer(value: unknown, field: string, maximum = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error(`Invalid lesson integer: ${field}`);
  }
  return value;
}

export function strings(value: unknown, field: string) {
  if (!Array.isArray(value)) throw new Error(`Invalid lesson array: ${field}`);
  const values = value.map((item) => text(item, field));
  if (new Set(values).size !== values.length) throw new Error(`Duplicate lesson values: ${field}`);
  return values;
}

export function timestamp(value: unknown, field: string) {
  const result = text(value, field);
  if (
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      result,
    ) ||
    !Number.isFinite(Date.parse(result))
  ) {
    throw new Error(`Invalid lesson timestamp: ${field}`);
  }
  const date = result.slice(0, 10);
  if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid lesson calendar date: ${field}`);
  }
  return result;
}

export function uuid(value: unknown, field: string) {
  const result = text(value, field);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result)) {
    throw new Error(`Invalid lesson UUID: ${field}`);
  }
  return result.toLowerCase();
}

export function nullable<T>(value: unknown, read: (value: unknown) => T): T | null {
  return value === null ? null : read(value);
}
