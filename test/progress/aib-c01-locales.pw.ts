import { expect, type Page, test } from '@playwright/test';
import { applyQuestionTranslation } from '../../src/questionTranslations';
import { parseQuestions, type Question, questionKey } from '../../src/questions';
import { examSessions, learningEventRows } from './api';
import { createSessions, setRealSession } from './sessions';

const course = '/study/ai-business-strategist/';
const bankPath = '/courses/ai-business-strategist/';
const practiceChoices = 'input[name="answer"]';
const examChoices = 'input[name="exam-answer"]';

async function bank(page: Page) {
  const response = await page.request.get(`${bankPath}full-mock-2026-11.json`);
  expect(response.ok()).toBe(true);
  return parseQuestions(await response.json());
}

async function translate(page: Page, questions: Question[], locale: 'en' | 'fr') {
  const response = await page.request.get(`${bankPath}locales/${locale}.json`);
  expect(response.ok()).toBe(true);
  return applyQuestionTranslation(questions, locale, await response.json());
}

function findQuestion(questions: Question[], prompt: string) {
  const question = questions.find((item) => item.prompt === prompt);
  if (!question) throw new Error(`Unknown question: ${prompt}`);
  return question;
}

async function switchLocale(page: Page, locale: 'en' | 'fr') {
  await page.locator('#site-locale').selectOption(locale);
  await expect(page).toHaveURL((url) => url.pathname === (locale === 'en' ? course : `/fr${course}`));
}

test('AIB-C01 keeps member review and full exam answers when switching languages', async ({ page }) => {
  const [session] = await createSessions();
  await page.goto(course);
  const cookies = page.getByRole('button', { name: 'Necessary only', exact: true });
  if (await cookies.isVisible()) await cookies.click();
  await setRealSession(page, session);
  await page.reload();

  const japanese = await bank(page);
  const english = await translate(page, japanese, 'en');
  const french = await translate(page, japanese, 'fr');

  const picker = page.locator('.question-set-picker');
  await picker.locator('select').nth(1).selectOption('1');
  await picker.locator('button').click();
  const prompt = page.locator('.prompt');
  await expect(prompt).toHaveAttribute('lang', 'en');
  const practiced = findQuestion(english, await prompt.innerText());
  const ordered = practiced.choices
    .map((choice, index) => ({ id: choice.id, index }))
    .sort(
      (first, second) =>
        Number(practiced.correct.includes(first.id)) - Number(practiced.correct.includes(second.id)),
    );
  for (const choice of ordered.slice(0, practiced.correct.length)) {
    await page.locator(practiceChoices).nth(choice.index).check();
  }
  await page.locator('.answer-footer button[type="submit"]').click();
  const identity = { question_id: practiced.id, question_revision: practiced.revision };
  await expect
    .poll(() => learningEventRows(session))
    .toEqual([expect.objectContaining({ ...identity, is_correct: false, attempt_number: 1 })]);

  await page.locator('.course-nav button').nth(2).click();
  await switchLocale(page, 'fr');
  const localized = french.find((item) => questionKey(item) === questionKey(practiced));
  if (!localized) throw new Error('French version of the reviewed question is missing.');
  await expect(page.locator('.review-list').getByText(localized.title, { exact: true })).toBeVisible();
  await page.locator('.review-list + button').click();
  await expect(prompt).toHaveAttribute('lang', 'fr');
  await expect(prompt).toHaveText(localized.prompt);
  for (const id of localized.correct) {
    const index = localized.choices.findIndex((item) => item.id === id);
    await page.locator(practiceChoices).nth(index).check();
  }
  await page.locator('.answer-footer button[type="submit"]').click();
  await expect
    .poll(() => learningEventRows(session))
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ...identity, is_correct: false, attempt_number: 1 }),
        expect.objectContaining({
          ...identity,
          is_correct: true,
          attempt_number: 2,
          prior_incorrect_count: 1,
        }),
      ]),
    );

  await switchLocale(page, 'en');
  await page.locator('.course-nav button').nth(1).click();
  const formats = page.locator('.exam-format-picker');
  await expect(formats.locator('option[value="full"]')).toHaveText(/85.*170/);
  await formats.locator('select').selectOption('full');
  await formats.locator('button[type="submit"]').click();
  await expect(prompt).toHaveAttribute('lang', 'en');
  const first = findQuestion(english, await prompt.innerText());
  const frenchFirst = french.find((item) => questionKey(item) === questionKey(first));
  if (!frenchFirst) throw new Error('French version of the exam question is missing.');
  const draft = await examSessions(session);
  expect(draft).toEqual([expect.objectContaining({ state: 'draft' })]);
  const saved = page.waitForResponse(
    (response) => response.url().includes('/rpc/save_exam_response_confirmed') && response.ok(),
  );
  await page.locator(examChoices).first().click();
  await saved;
  await expect(page.locator(examChoices).first()).toBeChecked();
  await switchLocale(page, 'fr');
  await expect(prompt).toHaveAttribute('lang', 'fr');
  await expect(prompt).toHaveText(frenchFirst.prompt);
  await expect(page.locator(examChoices).first()).toBeChecked();
  await page.reload();
  await page.locator('.course-nav button').nth(1).click();
  await expect(prompt).toHaveText(frenchFirst.prompt);
  await expect(page.locator(examChoices).first()).toBeChecked();
  expect(await examSessions(session)).toEqual(draft);
  expect(await page.evaluate(() => localStorage.getItem('saa-study.attempts.v1'))).toBeNull();
});
