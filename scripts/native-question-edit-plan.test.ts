import { expect, test } from 'bun:test';
import {
  type NativeTextEdit,
  type NativeTextField,
  validateNativeEditPlan,
} from './native-question-edit-plan';

const expected: NativeTextField[] = [
  {
    id: 'dop-c02-d1-008',
    sourceHash: '7657f13a4f89d4faa3601c12cceb29a2f0b429227d7c562d45f3147703c1f02e',
    locale: 'zh-TW',
    path: ['choices', 4, 'text'],
    before: '允許引受動作角色，並允許 B 的角色讀取 A 中相關的 S3 構件。',
  },
  {
    id: 'dop-c02-d1-008',
    sourceHash: '7657f13a4f89d4faa3601c12cceb29a2f0b429227d7c562d45f3147703c1f02e',
    locale: 'fr',
    path: ['choices', 4, 'text'],
    before: 'Autoriser l’assumption du rôle d’action.',
  },
];
const valid = (): NativeTextEdit[] => [
  { ...expected[0], after: '允許擔任動作角色，並允許 B 的角色讀取 A 中相關的 S3 構件。' },
  { ...expected[1], after: 'Permettre d’endosser le rôle d’action.' },
];

test('native edit plans accept reordered edits for the exact planned fields', () => {
  expect(() => validateNativeEditPlan(expected, valid().reverse())).not.toThrow();
});

test('the observed SAA/DOP association mixup is rejected even when the old text matches', () => {
  const edits = valid();
  edits[0] = {
    ...edits[0],
    id: 'saa-c03-sec05-core-001',
    sourceHash: 'b128cd8716e68e04a8638639ace4da0b223c51a164acb00ba8007c65bd1717fa',
  };
  expect(() => validateNativeEditPlan(expected, edits)).toThrow('unknown native question');
});

test('native edit plans reject incomplete, duplicated, stale, and blank proposals', () => {
  expect(() => validateNativeEditPlan(expected, valid().slice(0, 1))).toThrow('incomplete field set');
  expect(() => validateNativeEditPlan(expected, [valid()[0], valid()[0]])).toThrow('duplicate native');
  const stale = valid();
  stale[0].before = 'A previous translation';
  expect(() => validateNativeEditPlan(expected, stale)).toThrow('stale native edit text');
  const blank = valid();
  blank[0].after = ' ';
  expect(() => validateNativeEditPlan(expected, blank)).toThrow('empty native edit text');
});
