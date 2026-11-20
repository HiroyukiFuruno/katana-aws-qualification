import { expect, test } from '@playwright/test';
import { examKey, historyKey } from './guest-exam.helpers';
import { completeGuestExam, rows, startLegacyDraftManifest } from './migration-completed-exam.helpers';
import { createSessions, setRealSession, type RealSession } from './sessions';

type ExamSession = { exam_id: string; state: 'draft' | 'submitted' };
type ExamEvent = { exam_id: string };
type Manifest = { declared_rows: number; source_schema_version: number; status: string };

async function importSource(page: Parameters<typeof setRealSession>[0]) {
  await expect(page.getByRole('heading', { name: '端末の記録を引き継ぐ' })).toBeVisible();
  await page.getByRole('button', { name: '自分の記録を取り込む' }).click();
}

function examRows(session: RealSession, examId: string) {
  return rows<ExamSession>(
    `exam_sessions?exam_id=eq.${encodeURIComponent(examId)}&select=exam_id,state`,
    session,
  );
}

function eventRows(session: RealSession, examId: string) {
  return rows<ExamEvent>(
    `learning_events?exam_id=eq.${encodeURIComponent(examId)}&select=exam_id`,
    session,
  );
}

function draftRows(session: RealSession) {
  return rows<ExamSession>('exam_sessions?state=eq.draft&select=exam_id,state', session);
}

function draftManifests(session: RealSession) {
  return rows<Manifest>(
    'migration_manifests?source_name=eq.exam-draft-local-storage&select=status,declared_rows,source_schema_version',
    session,
  );
}

test('imports a completed guest exam once and removes its history and retained draft', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/ja/study/saa-c03/');
    const completed = await completeGuestExam(page);
    const history = JSON.parse(completed.history) as { examId?: string; mode?: string }[];
    const draft = JSON.parse(completed.draft) as {
      responses: Record<string, { flagged: boolean; selected: string[] }>;
    };
    expect(history).toHaveLength(2);
    expect(
      history.every((attempt) => attempt.examId === completed.examId && attempt.mode === 'exam'),
    ).toBe(true);
    expect(Object.values(draft.responses)).toEqual(
      expect.arrayContaining([expect.objectContaining({ flagged: true, selected: expect.any(Array) })]),
    );
    await setRealSession(page, session);
    await page.reload();
    await importSource(page);
    await expect
      .poll(() => examRows(session, completed.examId))
      .toEqual([{ exam_id: completed.examId, state: 'submitted' }]);
    await expect.poll(() => eventRows(session, completed.examId)).toHaveLength(2);
    await expect.poll(() => draftRows(session)).toEqual([]);
    await expect
      .poll(() =>
        page.evaluate((keys) => keys.map((key) => localStorage.getItem(key)), [historyKey, examKey]),
      )
      .toEqual([null, null]);
    await page.reload();
    await expect(page.locator('.metrics strong').first()).toHaveText('2');
    await expect(page.getByRole('heading', { name: '端末の記録を引き継ぐ' })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('cleans a retained completed draft despite a prior started legacy manifest', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/ja/study/saa-c03/');
    const completed = await completeGuestExam(page);
    await page.evaluate((key) => localStorage.removeItem(key), examKey);
    await setRealSession(page, session);
    await page.reload();
    await importSource(page);
    await expect.poll(() => eventRows(session, completed.examId)).toHaveLength(2);
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), historyKey)).toBeNull();
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: examKey,
      value: completed.draft,
    });
    await startLegacyDraftManifest(session, completed.draft);
    await page.reload();
    await importSource(page);
    await expect
      .poll(() => examRows(session, completed.examId))
      .toEqual([{ exam_id: completed.examId, state: 'submitted' }]);
    await expect.poll(() => eventRows(session, completed.examId)).toHaveLength(2);
    await expect.poll(() => draftRows(session)).toEqual([]);
    await expect
      .poll(() => draftManifests(session))
      .toEqual(
        expect.arrayContaining([
          { declared_rows: 1, source_schema_version: 1, status: 'started' },
          { declared_rows: 0, source_schema_version: 2, status: 'completed' },
        ]),
      );
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), examKey)).toBeNull();
  } finally {
    await context.close();
  }
});
