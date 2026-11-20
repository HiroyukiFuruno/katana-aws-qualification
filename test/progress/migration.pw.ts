import { expect, test } from '@playwright/test';
import { answerCurrentQuestion, startStudy } from './course';
import { fixtureKey, gatewayOrigin } from './settings';
import { createSessions, setRealSession } from './sessions';
const profileKey = 'katana.certification-profile.v1';

type RealSession = Awaited<ReturnType<typeof createSessions>>[number];
type Manifest = {
  manifest_id: string;
  source_name: string;
  status: string;
  declared_rows: number;
};
type MigrationItem = {
  source_row_id: string;
  outcome: string;
  reason_code: string | null;
  import_kind: string | null;
};
type EarnedRow = { certification_id: string };
type AssessmentRow = { assessment_id: string; answer: number };
async function rows<T>(path: string, session: RealSession) {
  const response = await fetch(`${gatewayOrigin}/rest/v1/${path}`, {
    headers: {
      apikey: fixtureKey('anon'),
      Authorization: `Bearer ${session.accessToken}`,
    },
  });
  if (!response.ok)
    throw new Error(`PostgREST read failed: ${response.status} ${await response.text()}`);
  return (await response.json()) as T[];
}
function manifests(session: RealSession, sourceName = 'profile-local-storage') {
  return rows<Manifest>(
    `migration_manifests?source_name=eq.${sourceName}&select=manifest_id,source_name,status,declared_rows`,
    session,
  );
}
function items(session: RealSession, manifestId: string) {
  return rows<MigrationItem>(
    `migration_items?manifest_id=eq.${encodeURIComponent(manifestId)}&select=source_row_id,outcome,reason_code,import_kind`,
    session,
  );
}
function earnedRows(session: RealSession) {
  return rows<EarnedRow>('earned_certifications?select=certification_id', session);
}
function assessmentRows(session: RealSession) {
  return rows<AssessmentRow>('assessment_answers?select=assessment_id,answer', session);
}
function learningEvents(session: RealSession) {
  return rows<{ question_id: string }>('learning_events?select=question_id', session);
}
test('member import prompt writes only after explicit import and removes verified profile source', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await context.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
      key: profileKey,
      value: JSON.stringify({ earned: ['saa-c03'], answers: {} }),
    });
    await page.goto('/ja/study/saa-c03/');
    await setRealSession(page, session);
    await page.reload();
    await expect(page.getByRole('heading', { name: '端末の記録を引き継ぐ' })).toBeVisible();
    await expect(page.getByText(/この端末の記録1件/)).toBeVisible();
    await expect.poll(() => manifests(session)).toEqual([]);
    await page.getByRole('button', { name: '自分の記録を取り込む' }).click();
    await expect
      .poll(() => manifests(session))
      .toEqual([
        expect.objectContaining({
          source_name: 'profile-local-storage',
          status: 'completed',
          declared_rows: 1,
        }),
      ]);
    const [manifest] = await manifests(session);
    await expect
      .poll(() => items(session, manifest.manifest_id))
      .toEqual([
        expect.objectContaining({
          source_row_id: 'profile',
          outcome: 'accepted',
          import_kind: 'roadmap-profile',
        }),
      ]);
    await expect.poll(() => earnedRows(session)).toEqual([{ certification_id: 'saa-c03' }]);
    await expect.poll(() => assessmentRows(session)).toEqual([]);
    await expect(page.evaluate((key) => localStorage.getItem(key), profileKey)).resolves.toBeNull();
    await startStudy(page);
    await answerCurrentQuestion(page);
    await expect.poll(() => learningEvents(session)).toHaveLength(1);
    await expect(page.locator('.metrics strong').first()).toHaveText('1');
  } finally {
    await context.close();
  }
});

test('unresolved legacy cookie remains on the device after a rejected import', async ({ browser }) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await context.addCookies([
      {
        name: 'saa_study_incorrect_v1',
        value: 'missing-question-id',
        url: 'http://127.0.0.1:5273/',
      },
    ]);
    await page.goto('/ja/study/saa-c03/');
    await setRealSession(page, session);
    await page.reload();
    await expect(page.getByRole('heading', { name: '端末の記録を引き継ぐ' })).toBeVisible();
    await expect.poll(() => manifests(session, 'wrong-cookie-v1')).toEqual([]);
    await page.getByRole('button', { name: '自分の記録を取り込む' }).click();
    await expect(
      page.getByText('取り込めない記録があります。端末の元データは残っています。'),
    ).toBeVisible();
    await expect
      .poll(() => manifests(session, 'wrong-cookie-v1'))
      .toEqual([
        expect.objectContaining({
          source_name: 'wrong-cookie-v1',
          status: 'completed',
          declared_rows: 1,
        }),
      ]);
    const [manifest] = await manifests(session, 'wrong-cookie-v1');
    await expect
      .poll(() => items(session, manifest.manifest_id))
      .toEqual([
        expect.objectContaining({
          source_row_id: 'cookie',
          outcome: 'rejected',
          reason_code: 'unreconstructed_cookie',
        }),
      ]);
    await expect(page.evaluate(() => document.cookie)).resolves.toContain('saa_study_incorrect_v1=');
  } finally {
    await context.close();
  }
});
