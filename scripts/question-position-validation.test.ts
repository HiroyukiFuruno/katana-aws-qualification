import { expect, test } from 'bun:test';
import {
  assertPositionIndependentQuestion,
  assertPositionIndependentText,
} from './question-position-validation';

test('question prose cannot rely on canonical letters or adjacent questions after shuffling', () => {
  for (const text of [
    '次問で確認する。',
    '前問の回答を使う。',
    '次問題の解答を参照する。',
    '選択肢Aが正解。',
    'Option B is correct.',
    '选项 C 正确。',
    'opción D',
  ])
    expect(() => assertPositionIndependentText(text, 'question')).toThrow('shuffled positions');
  expect(() =>
    assertPositionIndependentQuestion({ learning: { concept: 'See the next question.' } }, 'bank'),
  ).toThrow('bank.learning.concept');
});

test('繁体字の問題という語を日本語の隣接設問マーカーと誤判定しない', () => {
  for (const text of [
    '每次問題改變時，內容從開頭起就不再相同，因此無法重複使用。',
    '目前問題需要相同的資料。',
    '如果存在長度偏差，可以考慮這種做法，但沒有證據顯示此次問題是由長度造成。',
    '這或許適用於長度偏差，但沒有證據顯示這次問題是由回答長度造成。',
  ])
    expect(() => assertPositionIndependentText(text, 'question')).not.toThrow();
  expect(() =>
    assertPositionIndependentQuestion(
      { choices: [{ explanation: '每次問題改變時，內容從開頭起就不再相同。' }] },
      'bank',
    ),
  ).not.toThrow();
});

test('the observed prior-asked phrase is allowed but other prior-question references are rejected', () => {
  expect(() =>
    assertPositionIndependentText(
      '將重用結果連結至資料版本和適用情況，並在目前資訊變更時禁止繼續使用。新問題和先前問過的問題都要測試。',
      'question',
    ),
  ).not.toThrow();
  for (const text of ['先前問題的答案也要重新確認。', '先前問の回答を使う。', '先前問過の回答を使う。'])
    expect(() => assertPositionIndependentText(text, 'question')).toThrow('shuffled positions');
});

test('ordinary prose and technical identifiers remain valid', () => {
  for (const text of [
    'Answer a question about the document.',
    'Use AWS Lambda.',
    'A/B testing',
    'CIDRの範囲を確認する。',
  ])
    expect(() => assertPositionIndependentText(text, 'question')).not.toThrow();
});
