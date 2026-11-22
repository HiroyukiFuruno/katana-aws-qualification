import assert from 'node:assert/strict';
import type { Locale } from '../src/locales';

export type NativeTextField = {
  id: string;
  sourceHash: string;
  locale: Locale;
  path: readonly (string | number)[];
  before: string;
};
export type NativeTextEdit = NativeTextField & { after: string };

const identity = ({ id, sourceHash, locale, path }: NativeTextField) =>
  JSON.stringify([id, sourceHash, locale, path]);

export function validateNativeEditPlan(
  expected: readonly NativeTextField[],
  edits: readonly NativeTextEdit[],
) {
  assert.equal(edits.length, expected.length, 'Native edit plan: incomplete field set');
  const planned = new Map(expected.map((field) => [identity(field), field]));
  assert.equal(planned.size, expected.length, 'Native edit plan: duplicate expected field');
  const seen = new Set<string>();
  for (const edit of edits) {
    const key = identity(edit);
    const field = planned.get(key);
    assert(field, `${edit.id}: unknown native question/locale/field association`);
    assert(!seen.has(key), `${edit.id}: duplicate native edit field`);
    assert.equal(edit.before, field.before, `${edit.id}: stale native edit text`);
    assert(typeof edit.after === 'string' && edit.after.trim(), `${edit.id}: empty native edit text`);
    seen.add(key);
  }
}
