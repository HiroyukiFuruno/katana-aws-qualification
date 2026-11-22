import { expect, test } from 'bun:test';
import { answerLabels, choiceLabel } from '../src/choiceLabels';

test('display labels follow shuffled positions while stored IDs retain their meaning', () => {
  const choices = [{ id: 'D' }, { id: 'A' }, { id: 'C' }, { id: 'B' }];
  expect(choices.map((choice) => choiceLabel(choices, choice.id))).toEqual(['A', 'B', 'C', 'D']);
  expect(answerLabels(choices, ['A', 'B'])).toBe('B・D');
  expect(choices[1].id).toBe('A');
});
