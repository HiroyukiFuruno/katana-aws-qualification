import { expect, test } from '@playwright/test';
import { learningEvents } from './api';
import { openExam } from './course';
import { rows } from './migration-completed-exam.helpers';
import { historyKey, validAttempt } from './migration-history.helpers';
import { createSessions, setRealSession } from './sessions';

const olderId = '00000000-0000-4000-8000-000000000001';
const newerId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

test('migrated submitted exams without session dates use actual answer chronology', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/ja/study/saa-c03/');
    await page.evaluate(({ key, attempts }) => localStorage.setItem(key, JSON.stringify(attempts)), {
      key: historyKey,
      attempts: [
        { ...validAttempt, mode: 'exam', examId: olderId, answeredAt: '2026-01-01T00:00:00.000Z' },
        {
          ...validAttempt,
          mode: 'exam',
          examId: newerId,
          answeredAt: '2026-06-01T00:00:00.000Z',
          selected: ['B'],
          isCorrect: false,
          reward: 0,
          attemptNumber: 2,
        },
      ],
    });
    await setRealSession(page, session);
    await page.reload();
    await expect(page.getByRole('heading', { name: '端末の記録を引き継ぐ' })).toBeVisible();
    await page.getByRole('button', { name: '自分の記録を取り込む' }).click();
    await expect.poll(() => learningEvents(session)).toHaveLength(2);
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), historyKey)).toBeNull();
    const sessions = await rows<{
      exam_id: string;
      started_at: string | null;
      submitted_at: string | null;
      state: string;
    }>('exam_sessions?select=exam_id,started_at,submitted_at,state', session);
    expect(sessions).toEqual(
      expect.arrayContaining([
        { exam_id: olderId, started_at: null, submitted_at: null, state: 'submitted' },
        { exam_id: newerId, started_at: null, submitted_at: null, state: 'submitted' },
      ]),
    );
    expect(sessions).toHaveLength(2);

    await openExam(page);
    await page.getByRole('button', { name: '結果を見る', exact: true }).click();
    await expect(page.getByRole('heading', { name: '模擬試験の結果' })).toBeVisible();
    await expect(page.locator('.exam-score')).toHaveText('1問中 0問正解');
    await expect(page.locator('.exam-solutions > details')).toHaveCount(1);
    await page.locator('.exam-solutions > details > summary').click();
    await expect(page.locator('.exam-solutions > details').locator('li').first()).toBeVisible();

    await page.reload();
    await openExam(page);
    await page.getByRole('button', { name: '結果を見る', exact: true }).click();
    await expect(page.locator('.exam-score')).toHaveText('1問中 0問正解');
    expect(await learningEvents(session)).toHaveLength(2);
    expect(await rows('exam_sessions?select=exam_id,started_at,submitted_at,state', session)).toEqual(
      sessions,
    );
  } finally {
    await context.close();
  }
});
