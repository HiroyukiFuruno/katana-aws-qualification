import { expect, test } from '@playwright/test';
import { lessonPath } from '../../src/fundamentals/delivery/navigation';
import { lessonOutboxKey } from '../../src/fundamentals/state/outboxCodec';
import type { LessonCommand } from '../../src/fundamentals/state/outboxTypes';
import { readLessonSnapshot } from '../../src/fundamentals/state/snapshotCodec';
import { replayRpc } from './api';
import { lessonAssets, lessonPrefix } from './fundamentals.helpers';
import { archivedAsset, archivedGuestFinal } from './fundamentals-edition.fixture';
import { createSessions, type RealSession, setRealSession } from './sessions';

const currentAsset = lessonAssets.find((asset) => asset.unit.id === archivedAsset.unit.id);
if (!currentAsset) throw new Error('Missing current lesson fixture for the archived unit');
const guestKey = `${lessonPrefix}${archivedAsset.unit.id}.${archivedAsset.contentVersion}`;

async function snapshot(session: RealSession, asset: typeof archivedAsset | typeof currentAsset) {
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

function currentStep(): LessonCommand {
  const step = currentAsset.steps[0];
  if (!step) throw new Error('Missing current lesson step');
  return {
    commandId: crypto.randomUUID(),
    unitId: currentAsset.unit.id,
    contentVersion: currentAsset.contentVersion,
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
    name: `端末の記録を引き継ぐ · ${currentAsset.unit.title}`,
  });
  await prompt.getByRole('button', { name: '自分の記録を取り込む', exact: true }).click();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), guestKey)).toBeNull();
  expect((await snapshot(member, archivedAsset)).progress.passedAt).not.toBeNull();
  const command = staleStep();
  const preserved = currentStep();
  const rawOutbox = JSON.stringify({
    commands: [command, preserved],
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
  await archived.getByRole('button', { name: '再試行', exact: true }).click();
  await expect(archived.getByRole('alert')).toContainText(
    '端末に保存済みの内容と新しい未保存の内容があります',
  );
  await page.getByRole('button', { name: '保存済みの回答を再読み込み', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').commands, outboxKey),
    )
    .toEqual([preserved]);
  expect((await snapshot(member, archivedAsset)).progress.passedAt).not.toBeNull();
  const revised = await snapshot(member, currentAsset);
  expect(revised.progress.completedSlideIds).toHaveLength(0);
  expect(revised.progress.passedAt).toBeNull();
});

test('a valid unknown version opens the current unit, while mixed query data is rejected', async ({
  page,
}) => {
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
  await page.goto(href);
  await expect(page.locator('.lesson-slide-meta')).toBeVisible();
  const path = new URL(page.url()).pathname;
  expect(
    path.startsWith(lessonPath({ locale: 'ja', unitId: currentAsset.unit.id, stage: 'resume' })),
  ).toBe(true);
  expect(new URL(page.url()).search).toBe('');
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(raw);
  for (const target of [
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
