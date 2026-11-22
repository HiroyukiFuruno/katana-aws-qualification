import { expect, test } from 'bun:test';
import { canonical } from './question-localization-fixture';
import { localizeSessionQuestions } from '../src/questionPresentation';
import { localizePracticeSession, practiceQuestion } from '../src/practiceSession';
import { questionKey } from '../src/questions';

test('an active practice session retains the selected choice IDs and their display order on locale change', () => {
  const sessionQuestion = {
    ...canonical[0],
    choices: [canonical[0].choices[2], canonical[0].choices[0], canonical[0].choices[1]],
  };
  const localized = {
    ...canonical[0],
    title: 'Localized title',
    prompt: 'Localized prompt',
    choices: canonical[0].choices.map((choice) => ({
      ...choice,
      text: `Localized ${choice.id}`,
      explanation: `Explanation ${choice.id}`,
    })),
  };
  const replaced = localizeSessionQuestions([sessionQuestion], [localized]);
  expect(replaced[0].choices.map(({ id }) => id)).toEqual(['C', 'A', 'B']);
  expect(replaced[0].choices.map(({ text }) => text)).toEqual([
    'Localized C',
    'Localized A',
    'Localized B',
  ]);
  expect(replaced[0].correct).toEqual(['B']);
});

test('practice display keeps its randomized choice IDs instead of taking the canonical bank order', () => {
  const question = canonical[0];
  const presented = {
    ...question,
    choices: [question.choices[2], question.choices[0], question.choices[1]],
  };
  const available = new Map([[questionKey(question), question]]);
  expect(practiceQuestion(presented, available)?.choices.map(({ id }) => id)).toEqual(['C', 'A', 'B']);
});

test('missing localized session data produces an error state while retaining unsubmitted presentation for recovery', () => {
  const session = { questions: canonical, index: 0, correct: 0 };
  expect(() => localizeSessionQuestions(canonical, [])).toThrow('invalidQuestionData');
  const retained = localizePracticeSession(session, []);
  expect(retained?.translationError).toBe(true);
  expect(retained?.questions).toBe(session.questions);
  expect(localizePracticeSession(retained, canonical)?.translationError).toBe(false);
});
