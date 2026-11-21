import { expect, test } from 'bun:test';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssessmentQuestion } from '../src/AssessmentQuestion';
import { assessment } from '../src/assessment';
import type { AssessmentItem } from '../src/assessmentTypes';
import { locales } from '../src/locales';
import { messages } from '../src/messages';
import { RoadmapResults } from '../src/RoadmapResults';

const originalGrading: Pick<AssessmentItem, 'id' | 'skill' | 'correct'>[] = [
  { id: 'f1', skill: 'fundamentals', correct: 1 },
  { id: 'f2', skill: 'fundamentals', correct: 0 },
  { id: 'a1', skill: 'architecture', correct: 2 },
  { id: 'a2', skill: 'architecture', correct: 0 },
  { id: 's1', skill: 'security', correct: 1 },
  { id: 's2', skill: 'security', correct: 2 },
  { id: 'n1', skill: 'networking', correct: 0 },
  { id: 'n2', skill: 'networking', correct: 2 },
  { id: 'd1', skill: 'development', correct: 0 },
  { id: 'd2', skill: 'development', correct: 1 },
  { id: 'o1', skill: 'operations', correct: 2 },
  { id: 'o2', skill: 'operations', correct: 0 },
  { id: 'e1', skill: 'data', correct: 1 },
  { id: 'e2', skill: 'data', correct: 2 },
  { id: 'i1', skill: 'ai', correct: 0 },
  { id: 'i2', skill: 'ai', correct: 1 },
];
const escaped = (text: string) => renderToStaticMarkup(createElement(Fragment, null, text));

function idle() {}

test('localizes all sixteen assessment prompts and choices without changing stored grading', () => {
  expect(assessment.map(({ id, skill, correct }) => ({ id, skill, correct }))).toEqual(originalGrading);
  const keys = assessment.flatMap((item) => [item.prompt, ...item.options]);
  expect(new Set(keys).size).toBe(64);
  for (const item of assessment) {
    expect(item.options).toHaveLength(3);
    for (const locale of locales) {
      expect(messages[locale][item.prompt].trim().length).toBeGreaterThan(0);
      if (locale !== 'ja') expect(messages[locale][item.prompt]).not.toBe(messages.ja[item.prompt]);
      for (const option of item.options)
        expect(messages[locale][option].trim().length).toBeGreaterThan(0);
    }
  }
});

test('renders translated prompts and choice text in the assessment question', () => {
  for (const [position, item] of assessment.entries()) {
    const html = renderToStaticMarkup(
      createElement(AssessmentQuestion, {
        item,
        answer: undefined,
        position,
        total: assessment.length,
        selectAnswer: idle,
        onBack: idle,
        onNext: idle,
        saving: false,
      }),
    );
    expect(html).toContain(`<h2>${escaped(messages.en[item.prompt])}</h2>`);
    for (const option of item.options)
      expect(html).toContain(`<span>${escaped(messages.en[option])}</span>`);
    expect(html).not.toContain(item.prompt);
    expect(html).not.toContain('lang="ja"');
  }
});

test('renders translated selected and correct choices in the assessment results', () => {
  const first = assessment[0];
  const answers = Object.fromEntries(assessment.map((item) => [item.id, item.correct]));
  answers[first.id] = (first.correct + 1) % 3;
  answers[assessment[1].id] = assessment[1].options.length;
  answers[assessment[2].id] = 99;
  const html = renderToStaticMarkup(
    createElement(RoadmapResults, {
      items: assessment,
      earned: [],
      answers,
      today: '2026-11-22',
      onStudy: idle,
      onEdit: idle,
      onRetake: idle,
      saving: false,
    }),
  );
  for (const item of assessment) {
    expect(html).toContain(escaped(messages.en[item.prompt]));
    const option = item.options[answers[item.id]];
    const expected = option
      ? messages.en[option]
      : messages.en[answers[item.id] === item.options.length ? 'unknown' : 'unanswered'];
    expect(html).toContain(escaped(expected));
    expect(html).not.toContain(item.prompt);
    for (const choice of item.options) expect(html).not.toContain(choice);
  }
  expect(html).toContain(escaped(messages.en[first.options[first.correct]]));
});
