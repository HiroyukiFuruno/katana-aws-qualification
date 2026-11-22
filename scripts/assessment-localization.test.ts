import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssessmentQuestion } from '../src/AssessmentQuestion';
import { assessment } from '../src/assessment';
import type { AssessmentItem } from '../src/assessmentTypes';
import { locales } from '../src/locales';
import { messages } from '../src/messages';

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
const translatedItems = Object.fromEntries(
  locales.map((locale) => [
    locale,
    JSON.parse(readFileSync(`public/translations/${locale}/site.json`, 'utf8'))
      .assessment as AssessmentItem[],
  ]),
);
const escaped = (text: string) => renderToStaticMarkup(createElement(Fragment, null, text));

function idle() {}

test('localizes all sixteen assessment prompts and choices without changing stored grading', () => {
  expect(assessment.map(({ id, skill, correct }) => ({ id, skill, correct }))).toEqual(originalGrading);
  for (const locale of locales) {
    const localized = translatedItems[locale];
    expect(localized.map(({ id, skill, correct }) => ({ id, skill, correct }))).toEqual(originalGrading);
    expect(new Set(localized.flatMap((item) => [item.prompt, ...item.options])).size).toBe(64);
    for (const [index, item] of localized.entries()) {
      expect(item.options).toHaveLength(3);
      expect(item.prompt.trim().length).toBeGreaterThan(0);
      if (locale !== 'ja') expect(item.prompt).not.toBe(assessment[index].prompt);
      for (const option of item.options) expect(option.trim().length).toBeGreaterThan(0);
    }
  }
});

test('renders translated prompts and choice text in the assessment question', () => {
  for (const [position, item] of translatedItems.en.entries()) {
    const html = renderToStaticMarkup(
      createElement(AssessmentQuestion, {
        item,
        skillLabel: item.skill,
        choiceOrder: [0, 1, 2, 3],
        answer: undefined,
        position,
        total: assessment.length,
        selectAnswer: idle,
        onBack: idle,
        onNext: idle,
        saving: false,
      }),
    );
    expect(html).toContain(`<h2 lang="en">${escaped(item.prompt)}</h2>`);
    for (const option of item.options)
      expect(html).toContain(`<span lang="en">${escaped(option)}</span>`);
    expect(html).not.toContain(escaped(assessment[position].prompt));
    expect(html).not.toContain('lang="ja"');
  }
});

test('renders translated selected and correct choices in the assessment results', () => {
  const items = translatedItems.en;
  const first = items[0];
  const answers = Object.fromEntries(assessment.map((item) => [item.id, item.correct]));
  answers[first.id] = (first.correct + 1) % 3;
  answers[assessment[1].id] = assessment[1].options.length;
  answers[assessment[2].id] = 99;
  const rendered = Bun.spawnSync({
    cmd: ['bun', 'scripts/assessment-results-render.ts', JSON.stringify(answers)],
    stdout: 'pipe',
    stderr: 'pipe',
  });
  expect(rendered.exitCode).toBe(0);
  const html = rendered.stdout.toString();

  for (const item of items) {
    expect(html).toContain(escaped(item.prompt));
    const option = item.options[answers[item.id]];
    const expected = option
      ? option
      : messages.en[answers[item.id] === item.options.length ? 'unknown' : 'unanswered'];
    expect(html).toContain(escaped(expected));
  }
  expect(html).toContain(escaped(first.options[first.correct]));
});
