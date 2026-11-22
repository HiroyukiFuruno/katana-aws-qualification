import { expect, test } from 'bun:test';
import { canonicalInstant, dateInTimezone, isPlainDate, remainingDays } from '../src/milestones/dates';

test('validates plain dates without UTC day shifts', () => {
  expect(isPlainDate('2026-02-28')).toBe(true);
  expect(isPlainDate('2026-02-29')).toBe(false);
  expect(isPlainDate('0000-01-01')).toBe(false);
  expect(isPlainDate('0001-01-01')).toBe(true);
  expect(canonicalInstant('2026-02-01T00:00')).toBe(null);
  expect(canonicalInstant('2026-02-30T00:00:00Z')).toBe(null);
  expect(canonicalInstant('2026-02-01T00:00:00.123456+00:00')).toBe('2026-02-01T00:00:00.123Z');
  expect(remainingDays('2026-03-01', '2026-02-28')).toBe(1);
  expect(dateInTimezone('2026-03-01T00:30:00.000Z', 'America/Los_Angeles')).toBe('2026-02-28');
});

test('rejects nonexistent local DST time and chooses earlier duplicate instant', () => {
  const output = Bun.spawnSync(
    [
      'bun',
      '-e',
      "import {parseLocalDateTime} from './src/milestones/dates.ts'; process.stdout.write(parseLocalDateTime('2026-03-08T02:30') ?? 'null')",
    ],
    {
      env: { ...process.env, TZ: 'America/New_York' },
    },
  );
  expect(output.stdout.toString()).toBe('null');
  const duplicate = Bun.spawnSync(
    [
      'bun',
      '-e',
      "import {parseLocalDateTime} from './src/milestones/dates.ts'; process.stdout.write(parseLocalDateTime('2026-11-01T01:30') ?? 'null')",
    ],
    {
      env: { ...process.env, TZ: 'America/New_York' },
    },
  );
  expect(duplicate.stdout.toString()).toBe('2026-11-01T05:30:00.000Z');
});

test('parses a year-one local ISO value', () => {
  const output = Bun.spawnSync(
    [
      'bun',
      '-e',
      "import {parseLocalDateTime} from './src/milestones/dates.ts'; process.stdout.write(parseLocalDateTime('0001-01-01T00:00') ?? 'null')",
    ],
    { env: { ...process.env, TZ: 'UTC' } },
  );
  expect(output.stdout.toString()).toBe('0001-01-01T00:00:00.000Z');
});
