import { expect, test } from '@playwright/test';
import { lessonPath } from '../../src/fundamentals/delivery/navigation';
import { lessonOutboxKey } from '../../src/fundamentals/state/outboxCodec';
import type { LessonCommand } from '../../src/fundamentals/state/outboxTypes';
import { readLessonSnapshot } from '../../src/fundamentals/state/snapshotCodec';
import { replayRpc } from './api';
import { lessonAssets, lessonPrefix } from './fundamentals.helpers';
import { archivedAsset, archivedGuestFinal } from './fundamentals-edition.fixture';
import { createSessions, type RealSession, setRealSession } from './sessions';

const currentAsset = lessonAssets[0];
if (!currentAsset) throw new Error('Missing current lesson fixture');
const guestKey = `${lessonPrefix}${archivedAsset.unit.id}.${archivedAsset.contentVersion}`;

async function snapshot(session: RealSession, asset: typeof archivedAsset) {
  const response = await replayRpc('/rpc/load_fundamentals_snapshot', session.accessToken, {
    p_unit_id: asset.unit.id,
    p_content_version: asset.contentVersion,
    p_expected_generation: 0,
  });
  expect(response.ok).toBe(true);
  return readLessonSnapshot(await response.json(), asset);
}

function staleStep(): LessonCommand {
  const step = archivedAsset.steps[0];
  if (!step) throw new Error('Missing archived lesson step');
  return {
    commandId: crypto.randomUUID(),
    unitId: archivedAsset.unit.id,
    contentVersion: archivedAsset.contentVersion,
    kind: 'recordStep',
    input: { stepId: step.id, expectedRevision: 0, receiptId: crypto.randomUUID(), durationMs: 20 },
  };
}

test('an archived stale command requires explicit reload and preserves the archived pass', async ({
  page,
}) => {
  const [member] = await createSessions();
  const rawGuest = JSON.stringify(archivedGuestFinal(true));
  const outboxKey = lessonOutboxKey(member.userId);
  await page.goto('/ja/study/fundamentals/');
  await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
  await page.getByLabel('ゲストの学習記録をこの端末に保存する').check();
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: guestKey,
    raw: rawGuest,
  });
  await setRealSession(page, member);
  const prompt = page.getByRole('region', {
    name: `端末の記録を引き継ぐ · ${archivedAsset.unit.title}`,
  });
  await prompt.getByRole('button', { name: '自分の記録を取り込む', exact: true }).click();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), guestKey)).toBeNull();
  expect((await snapshot(member, archivedAsset)).progress.passedAt).not.toBeNull();
  const command = staleStep();
  const rawOutbox = JSON.stringify({
    commands: [command],
    generation: 0,
    userId: member.userId,
    version: 1,
  });
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: outboxKey,
    raw: rawOutbox,
  });
  await page.reload();
  const archived = page.locator('.lesson-archived-records');
  await archived.locator('summary').click();
  await expect(archived.getByRole('status')).toContainText('保存待ちの記録があります');
  await archived.getByRole('link').click();
  await expect(page.getByRole('alert')).toContainText('基礎教材を読み込めませんでした');
  await page.getByRole('button', { name: '保存済みの回答を再読み込み', exact: true }).click();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), outboxKey)).toBeNull();
  expect((await snapshot(member, archivedAsset)).progress.passedAt).not.toBeNull();
  const revised = await snapshot(member, currentAsset);
  expect(revised.progress.completedSlideIds).toHaveLength(0);
  expect(revised.progress.passedAt).toBeNull();
});

test('an unknown edition never falls back or rewrites a valid owner outbox', async ({ page }) => {
  const [member] = await createSessions();
  const command = staleStep();
  const key = lessonOutboxKey(member.userId);
  const raw = JSON.stringify({ commands: [command], generation: 0, userId: member.userId, version: 1 });
  const unknown = '0'.repeat(64);
  await page.goto('/ja/study/fundamentals/');
  await setRealSession(page, member);
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
  const href = lessonPath({
    locale: 'ja',
    unitId: archivedAsset.unit.id,
    stage: 'resume',
    contentVersion: unknown,
  });
  for (const target of [
    href,
    `${href}&unit=${archivedAsset.unit.id}`,
    `/ja/study/fundamentals/?version=${unknown}&unit=${archivedAsset.unit.id}`,
  ]) {
    await page.goto(target);
    await expect(page.getByRole('alert')).toContainText('基礎教材を読み込めませんでした');
    expect(new URL(page.url()).searchParams.get('version')).toBe(unknown);
    await expect(page.locator('.lesson-slide-meta')).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(raw);
  }
});
