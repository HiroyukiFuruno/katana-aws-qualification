import { expect, test } from '@playwright/test';
import compatibility from '../../src/fundamentals/delivery/compatibleAnswers.json' with { type: 'json' };
import legacy from '../../src/fundamentals/delivery/legacyRecordAssets.json' with { type: 'json' };
import { lessonPath } from '../../src/fundamentals/delivery/navigation';
import {
  type LessonRecordAsset,
  readLessonRecordAsset,
} from '../../src/fundamentals/delivery/recordAsset';
import { initialGuestLesson } from '../../src/fundamentals/state/guestInitial';
import { recordGuestLessonStep } from '../../src/fundamentals/state/guestStep';
import { readLessonSnapshot } from '../../src/fundamentals/state/snapshotCodec';
import { learningEventRows, replayRpc } from './api';
import { lessonAssets, lessonPrefix } from './fundamentals.helpers';
import { createSessions, type RealSession, setRealSession } from './sessions';

const questionId = 'fundamentals.testing-quality.checkpoint.quality-gates.v1';
const mapping = compatibility.units.find(({ questions }) => questions.includes(questionId));
if (!mapping) throw new Error('Missing quality gate compatibility');
const current = lessonAssets.find((asset) => asset.unit.id === mapping.unitId);
const historical = legacy.assets.find(
  (asset) => asset.unit.id === mapping.unitId && mapping.previous.includes(asset.contentVersion),
);
if (!current || !historical) throw new Error('Missing real lesson data');
const previous = readLessonRecordAsset(historical, historical.unit.id, historical.contentVersion);
const target = current.steps.find((step) => step.assessmentId === questionId);
if (!target) throw new Error('Missing current quality gate');
const href = lessonPath({
  locale: 'ja',
  unitId: current.unit.id,
  stage: 'checkpoints',
  position: target.position,
});
const label = '以前の回答を表示しています。内容を確認してから進んでください。';

function lessonKey(asset: LessonRecordAsset) {
  return `${lessonPrefix}${asset.unit.id}.${asset.contentVersion}`;
}

function preparation(asset: LessonRecordAsset, includeTarget: boolean) {
  const limit = asset.steps.findIndex((step) => step.assessmentId === questionId);
  if (limit < 0) throw new Error('Missing quality gate reference');
  return asset.steps.slice(0, limit + Number(includeTarget)).map((step) => {
    const question = asset.checkpoints.find((item) => item.id === step.assessmentId);
    return { step, selected: question?.correct, receiptId: crypto.randomUUID() };
  });
}

function savedGuestSource(asset: LessonRecordAsset, includeTarget: boolean) {
  const answeredAt = new Date().toISOString();
  return preparation(asset, includeTarget).reduce(
    (source, { step, selected, receiptId }) =>
      recordGuestLessonStep(
        source,
        asset,
        step.id,
        selected && {
          selected,
          receiptId,
          answeredAt,
          durationMs: 20,
        },
      ).source,
    initialGuestLesson(asset),
  );
}

async function saveMemberPreparation(
  member: RealSession,
  asset: LessonRecordAsset,
  includeTarget: boolean,
) {
  for (const [revision, { step, selected, receiptId }] of preparation(asset, includeTarget).entries()) {
    const response = await replayRpc('/rpc/record_fundamentals_step', member.accessToken, {
      p_unit_id: asset.unit.id,
      p_content_version: asset.contentVersion,
      p_kind: selected ? 'checkpoint' : 'slide',
      p_step_id: step.id,
      p_selected: selected ?? null,
      p_expected_revision: revision,
      p_expected_generation: 0,
      p_receipt_id: receiptId,
      p_duration_ms: 20,
    });
    expect(response.ok).toBe(true);
  }
}

for (const kind of ['guest', 'member'] as const) {
  test(`a ${kind} sees the equivalent previous answer by meaning before saving it to the current lesson`, async ({
    page,
  }) => {
    expect(current.contentVersion).toBe(mapping.contentVersion);
    await page.goto('/ja/study/fundamentals/');
    await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
    const oldBytes = JSON.stringify(savedGuestSource(previous, true));
    const newBytes = JSON.stringify(savedGuestSource(current, false));
    let member: RealSession | undefined;
    if (kind === 'guest') {
      await page.getByLabel('ゲストの学習記録をこの端末に保存する').check();
      await page.evaluate(
        ({ oldKey, newKey, oldBytes, newBytes }) => {
          localStorage.setItem(oldKey, oldBytes);
          localStorage.setItem(newKey, newBytes);
        },
        { oldKey: lessonKey(previous), newKey: lessonKey(current), oldBytes, newBytes },
      );
    } else {
      [member] = await createSessions();
      const initialized = await replayRpc('/rpc/initialize_learning_state', member.accessToken, {});
      expect(await initialized.json()).toBe(0);
      await saveMemberPreparation(member, previous, true);
      await saveMemberPreparation(member, current, false);
      await setRealSession(page, member);
    }
    await page.goto(href);
    await expect(page.getByText(label, { exact: true })).toBeVisible();
    const choices = page.locator(`fieldset input[name="${questionId}"]`);
    await expect(choices.and(page.locator('[value="A"]'))).toBeChecked();
    await expect(choices.and(page.locator('[value="C"]'))).toBeChecked();
    await expect(choices.and(page.locator('[value="B"]'))).not.toBeChecked();
    if (member) {
      const saved = await replayRpc('/rpc/load_fundamentals_snapshot', member.accessToken, {
        p_unit_id: current.unit.id,
        p_content_version: current.contentVersion,
        p_expected_generation: 0,
      });
      expect(saved.ok).toBe(true);
      expect(
        readLessonSnapshot(await saved.json(), current).progress.completedCheckpointIds,
      ).not.toContain(target.id);
    } else {
      expect(await page.evaluate((key) => localStorage.getItem(key), lessonKey(current))).toBe(newBytes);
    }
    await page.getByRole('button', { name: '回答を確認', exact: true }).click();
    await expect(page.locator('.lesson-assessment').getByRole('status')).toHaveText('正解です。');
    await expect(page.getByText(label, { exact: true })).toHaveCount(0);
    if (member) {
      const rows = await learningEventRows(member);
      const answers = rows
        .filter((row) => row.question_id === questionId)
        .map((row) => row.selected.join(','));
      expect(answers.sort()).toEqual(['A,C', 'B,C']);
    } else {
      expect(await page.evaluate((key) => localStorage.getItem(key), lessonKey(previous))).toBe(
        oldBytes,
      );
    }
  });
}
