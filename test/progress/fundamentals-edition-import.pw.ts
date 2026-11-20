import { expect, test } from '@playwright/test';
import { readLessonSnapshot } from '../../src/fundamentals/state/snapshotCodec';
import { learningEvents, replayRpc } from './api';
import { archivedAsset, archivedGuestFinal } from './fundamentals-edition.fixture';
import { lessonAssets, lessonPrefix } from './fundamentals.helpers';
import { createSessions, type RealSession, setRealSession } from './sessions';

const currentAsset = lessonAssets[0];
if (!currentAsset) throw new Error('Missing current lesson fixture');
const key = `${lessonPrefix}${archivedAsset.unit.id}.${archivedAsset.contentVersion}`;
async function snapshot(session: RealSession, asset: typeof archivedAsset) {
  const initialized = await replayRpc('/rpc/initialize_learning_state', session.accessToken, {});
  expect(await initialized.json()).toBe(0);
  const response = await replayRpc('/rpc/load_fundamentals_snapshot', session.accessToken, {
    p_unit_id: asset.unit.id,
    p_content_version: asset.contentVersion,
    p_expected_generation: 0,
  });
  expect(response.ok).toBe(true);
  return readLessonSnapshot(await response.json(), asset);
}

for (const submitted of [false, true]) {
  test(`an archived guest ${submitted ? 'pass' : 'draft'} imports once without completing the revised lesson`, async ({
    page,
  }) => {
    const [a, b] = await createSessions();
    expect(archivedAsset.contentVersion).not.toBe(currentAsset.contentVersion);
    const raw = JSON.stringify(archivedGuestFinal(submitted));
    await page.goto('/ja/study/fundamentals/');
    await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
    await page.getByLabel('ゲストの学習記録をこの端末に保存する').check();
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
    await page.reload();
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(raw);
    await setRealSession(page, a);
    const prompt = page.getByRole('region', {
      name: `端末の記録を引き継ぐ · ${archivedAsset.unit.title}`,
    });
    await expect(prompt).toBeVisible();
    expect(await learningEvents(a)).toHaveLength(0);
    await prompt.getByRole('button', { name: '自分の記録を取り込む', exact: true }).click();
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
    const old = await snapshot(a, archivedAsset);
    expect(old.sessions).toHaveLength(1);
    expect(old.sessions[0]?.state).toBe(submitted ? 'submitted' : 'draft');
    if (submitted) expect(old.sessions[0]).toMatchObject({ score: 12, passed: true });
    else expect(Object.keys(old.sessions[0]?.responses ?? {})).toHaveLength(12);
    const revised = await snapshot(a, currentAsset);
    expect(revised.sessions).toHaveLength(0);
    expect(revised.progress.completedSlideIds).toHaveLength(0);
    expect(revised.progress.passedAt).toBeNull();
    expect((await snapshot(b, archivedAsset)).sessions).toHaveLength(0);
    expect(await learningEvents(b)).toHaveLength(0);
    expect(await learningEvents(a)).toHaveLength(submitted ? 16 : 4);
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
    await page.reload();
    await prompt.getByRole('button', { name: '自分の記録を取り込む', exact: true }).click();
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
    expect(await snapshot(a, archivedAsset)).toEqual(old);
    expect(await learningEvents(a)).toHaveLength(submitted ? 16 : 4);
  });
}
