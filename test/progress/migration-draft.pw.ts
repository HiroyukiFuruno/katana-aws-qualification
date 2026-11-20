import { expect, test } from '@playwright/test';
import { createSessions, type RealSession, setRealSession } from './sessions';
import { fixtureKey, gatewayOrigin } from './settings';

const examKey = 'saa-study.exam.v1';
type Manifest = { manifest_id: string; status: string; declared_rows: number };
type ExamSession = { exam_id: string; position: number; state: string };
type ExamResponse = {
  exam_id: string;
  question_key: string;
  selected: string[];
  flagged: boolean;
  duration_ms: number;
  selected_at: string | null;
};

async function rows<T>(path: string, session: RealSession) {
  const response = await fetch(`${gatewayOrigin}/rest/v1/${path}`, {
    headers: { apikey: fixtureKey('anon'), Authorization: `Bearer ${session.accessToken}` },
  });
  if (!response.ok)
    throw new Error(`PostgREST read failed: ${response.status} ${await response.text()}`);
  return (await response.json()) as T[];
}

test('imports a real draft response, removes the source, and resumes it', async ({ browser }) => {
  const [session] = await createSessions();
  const examId = '20000000-0000-0000-0000-000000000021';
  const deadline = Date.now() + 60 * 60 * 1000;
  const selectedAt = Date.now() - 1000;
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/ja/study/saa-c03/');
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
      key: examKey,
      value: {
        id: examId,
        deadline,
        order: ['["mock-secure-01",2]'],
        position: 0,
        responses: {
          '["mock-secure-01",2]': {
            selected: ['A'],
            flagged: true,
            durationMs: 1200,
            selectedAt,
          },
        },
      },
    });
    await setRealSession(page, session);
    await page.reload();
    await expect(page.getByRole('heading', { name: '端末の記録を引き継ぐ' })).toBeVisible();
    await expect(page.getByText(/この端末の記録1件/)).toBeVisible();
    await page.getByRole('button', { name: '模擬試験' }).click();
    await expect(page.getByRole('heading', { name: '模擬試験の出題設定' })).toBeVisible();
    await expect
      .poll(() =>
        rows<Manifest>(
          'migration_manifests?source_name=eq.exam-draft-local-storage&select=manifest_id,status,declared_rows',
          session,
        ),
      )
      .toEqual([]);
    await page.getByRole('button', { name: '自分の記録を取り込む' }).click();
    const manifests = () =>
      rows<Manifest>(
        'migration_manifests?source_name=eq.exam-draft-local-storage&select=manifest_id,status,declared_rows',
        session,
      );
    await expect
      .poll(manifests)
      .toEqual([{ manifest_id: expect.any(String), status: 'completed', declared_rows: 1 }]);
    await expect
      .poll(() =>
        rows<ExamSession>(`exam_sessions?exam_id=eq.${examId}&select=exam_id,position,state`, session),
      )
      .toEqual([{ exam_id: examId, position: 0, state: 'draft' }]);
    await expect
      .poll(async () => {
        const [response] = await rows<ExamResponse>(`exam_responses?exam_id=eq.${examId}`, session);
        return response
          ? {
              exam_id: response.exam_id,
              question_key: JSON.parse(response.question_key) as unknown,
              selected: response.selected,
              flagged: response.flagged,
              duration_ms: response.duration_ms,
              selected_at_ms: response.selected_at ? Date.parse(response.selected_at) : null,
            }
          : undefined;
      })
      .toEqual({
        exam_id: examId,
        question_key: { question_id: 'mock-secure-01', question_revision: 2 },
        selected: ['A'],
        flagged: true,
        duration_ms: 1200,
        selected_at_ms: selectedAt,
      });
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), examKey)).toBeNull();
    await expect(page.getByRole('heading', { name: '第1問' })).toBeVisible();
    await expect(page.locator('input[name="exam-answer"]').first()).toBeChecked();
    await expect(page.getByRole('button', { name: '見直しマーク' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.reload();
    await page.getByRole('button', { name: '模擬試験' }).click();
    await expect(page.getByRole('heading', { name: '第1問' })).toBeVisible();
    await expect(page.locator('input[name="exam-answer"]').first()).toBeChecked();
    await expect(page.getByRole('button', { name: '見直しマーク' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  } finally {
    await context.close();
  }
});
