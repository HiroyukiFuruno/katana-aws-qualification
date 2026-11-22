import { expect, test } from 'bun:test';
import { databaseArgs } from '../test/account-merge/commands';

test('sends database SQL through psql stdin instead of docker argv', () => {
  const args = databaseArgs(true);
  expect(args).toContain('-f');
  expect(args.at(-1)).toBe('-');
  expect(args).not.toContain('-c');
  expect(args).toContain('--set=VERBOSITY=verbose');
});
