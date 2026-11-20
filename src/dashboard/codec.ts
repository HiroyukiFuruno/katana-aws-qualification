export function dashboardRecord(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Dashboard value must be an object.');
  const row = value as Record<string, unknown>;
  const allowed = new Set([...required, ...optional]);
  if (
    required.some((key) => !Object.hasOwn(row, key)) ||
    Object.keys(row).some((key) => !allowed.has(key))
  )
    throw new Error('Dashboard object has unexpected fields.');
  return row;
}

export function dashboardText(value: unknown, maximum = 200) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maximum ||
    Array.from(value).some((character) => character.charCodeAt(0) < 32)
  )
    throw new Error('Invalid dashboard text.');
  return value;
}

export function dashboardEnum<const T extends readonly string[]>(value: unknown, allowed: T): T[number] {
  const result = dashboardText(value);
  if (!allowed.includes(result)) throw new Error('Invalid dashboard choice.');
  return result;
}

export function dashboardNumber(value: unknown, maximum = Number.MAX_SAFE_INTEGER, integral = true) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > maximum ||
    (integral && !Number.isSafeInteger(value))
  )
    throw new Error('Invalid dashboard number.');
  return value;
}

export function dashboardArray<T>(value: unknown, read: (item: unknown) => T, maximum = 200) {
  if (!Array.isArray(value) || value.length > maximum) throw new Error('Invalid dashboard array.');
  return value.map(read);
}

export function dashboardSelection<T>(value: unknown, read: (item: unknown) => T) {
  if (value === null) return null;
  const items = dashboardArray(value, read);
  const keys = items.map((item) => JSON.stringify(item));
  if (!items.length || new Set(keys).size !== items.length)
    throw new Error('Invalid dashboard selection.');
  return items.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
}

export function dashboardTimezone(value: unknown) {
  const timezone = dashboardText(value, 100);
  if (!/^[a-z_]+(?:\/[a-z0-9_+-]+)*$/i.test(timezone)) throw new Error('Invalid dashboard timezone.');
  return new Intl.DateTimeFormat('en', { timeZone: timezone }).resolvedOptions().timeZone;
}
