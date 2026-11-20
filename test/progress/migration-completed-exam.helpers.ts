import { createHash, randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import {
  answerExamQuestion,
  allowGuestStorage,
  examKey,
  historyKey,
  startCustomExam,
} from './guest-exam.helpers';
import { fixtureKey, gatewayOrigin } from './settings';
import type { RealSession } from './sessions';

export type GuestCompletedExam = { draft: string; examId: string; history: string };

export async function completeGuestExam(page: Page): Promise<GuestCompletedExam> {
  await allowGuestStorage(page);
  await startCustomExam(page, 2);
  await answerExamQuestion(page);
  await page.getByRole('button', { exact: true, name: '見直しマーク' }).click();
  await page.getByRole('button', { name: '試験を提出する' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '提出する' }).click();
  await expect(page.getByRole('heading', { name: '模擬試験の結果' })).toBeVisible();
  return page.evaluate(
    ({ draftKey, attemptsKey }) => {
      const draft = localStorage.getItem(draftKey);
      const history = localStorage.getItem(attemptsKey);
      if (!draft || !history) throw new Error('Completed guest exam was not retained.');
      const value = JSON.parse(draft) as { id?: unknown };
      if (typeof value.id !== 'string') throw new Error('Guest exam ID is missing.');
      return { draft, examId: value.id, history };
    },
    { attemptsKey: historyKey, draftKey: examKey },
  );
}

export async function rows<T>(path: string, session: RealSession) {
  const response = await fetch(`${gatewayOrigin}/rest/v1/${path}`, {
    headers: { apikey: fixtureKey('anon'), Authorization: `Bearer ${session.accessToken}` },
  });
  if (!response.ok)
    throw new Error(`PostgREST read failed: ${response.status} ${await response.text()}`);
  return (await response.json()) as T[];
}

async function rpc<T>(name: string, body: object, session: RealSession) {
  const response = await fetch(`${gatewayOrigin}/rest/v1/rpc/${name}`, {
    body: JSON.stringify(body),
    headers: {
      apikey: fixtureKey('anon'),
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  if (!response.ok) throw new Error(`Migration fixture RPC failed: ${response.status}`);
  return (await response.json()) as T;
}

export async function startLegacyDraftManifest(session: RealSession, raw: string) {
  const generation = await rpc<number>('initialize_learning_state', {}, session);
  const fingerprint = createHash('sha256').update(raw).digest('hex');
  return rpc<string>(
    'begin_migration',
    {
      p_declared_rows: 1,
      p_expected_generation: generation,
      p_fingerprint: fingerprint,
      p_manifest_id: randomUUID(),
      p_schema_version: 1,
      p_source_name: 'exam-draft-local-storage',
    },
    session,
  );
}
