const plainDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const instantPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?(Z|[+-]\d{2}:\d{2})$/;

function parts(value: string) {
  const match = plainDatePattern.exec(value);
  if (!match || match[1] === '0000') return null;
  const candidate = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(candidate)) return null;
  const date = new Date(candidate);
  return date.toISOString().slice(0, 10) === value
    ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
    : null;
}

export function isPlainDate(value: string): boolean {
  return typeof value === 'string' && parts(value) !== null;
}

export function parseLocalDateTime(value: string): string | null {
  const match = typeof value === 'string' ? localDateTimePattern.exec(value) : null;
  if (!match || !isPlainDate(`${match[1]}-${match[2]}-${match[3]}`)) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (hour > 23 || minute > 59) return null;
  const instant = new Date(value);
  if (
    instant.getFullYear() !== year ||
    instant.getMonth() !== month - 1 ||
    instant.getDate() !== day ||
    instant.getHours() !== hour ||
    instant.getMinutes() !== minute
  )
    return null;
  return instant.toISOString();
}

export function canonicalInstant(value: string): string | null {
  const match = typeof value === 'string' ? instantPattern.exec(value) : null;
  if (!match || !isPlainDate(`${match[1]}-${match[2]}-${match[3]}`)) return null;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

function validInstant(value: string) {
  const canonical = canonicalInstant(value);
  if (canonical === null) throw new Error('Invalid instant.');
  return new Date(canonical);
}

export function localDateTimeInput(instant: string): string {
  const date = validInstant(instant);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function dateInTimezone(instant: string, timeZone: string): string {
  const date = validInstant(instant);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const values = Object.fromEntries(
    formatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  if (!values.year || !values.month || !values.day) throw new Error('Invalid timezone date.');
  return `${values.year.padStart(4, '0')}-${values.month}-${values.day}`;
}

export function remainingDays(targetPlain: string, todayPlain: string): number {
  if (!isPlainDate(targetPlain) || !isPlainDate(todayPlain)) throw new Error('Invalid plain date.');
  return Math.round(
    (Date.parse(`${targetPlain}T00:00:00Z`) - Date.parse(`${todayPlain}T00:00:00Z`)) / 86_400_000,
  );
}
