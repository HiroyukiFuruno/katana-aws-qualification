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

const label = '以前の回答を表示しています。内容を確認してから進んでください。';

const lessonKey = ({ unit, contentVersion }: LessonRecordAsset) =>
  `${lessonPrefix}${unit.id}.${contentVersion}`;

function preparation(asset: LessonRecordAsset, questionId: string, includeTarget: boolean) {
  const limit = asset.steps.findIndex((step) => step.assessmentId === questionId);
  if (limit < 0) throw new Error('Missing archived checkpoint reference');
  return asset.steps.slice(0, limit + Number(includeTarget)).map((step) => {
    const question = asset.checkpoints.find((item) => item.id === step.assessmentId);
    return { step, selected: question?.correct, receiptId: crypto.randomUUID() };
  });
}

function savedGuestSource(asset: LessonRecordAsset, questionId: string, includeTarget: boolean) {
  const answeredAt = new Date().toISOString();
  return preparation(asset, questionId, includeTarget).reduce(
    (source, { step, selected, receiptId }) => {
      const answer = selected && { selected, receiptId, answeredAt, durationMs: 20 };
      return recordGuestLessonStep(source, asset, step.id, answer).source;
    },
    initialGuestLesson(asset),
  );
}

async function saveMemberPreparation(
  member: RealSession,
  asset: LessonRecordAsset,
  questionId: string,
  includeTarget: boolean,
) {
  const steps = preparation(asset, questionId, includeTarget);
  for (const [revision, { step, selected, receiptId }] of steps.entries()) {
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

for (const questionId of [
  'fundamentals.testing-quality.checkpoint.quality-gates.v1',
  'fundamentals.routing-connectivity.checkpoint.internet-egress.v1',
]) {
  const mapping = compatibility.units.find(({ questions }) => questions.includes(questionId));
  if (!mapping) throw new Error('Missing reviewed answer compatibility');
  const current = lessonAssets.find((asset) => asset.unit.id === mapping.unitId);
  const historical = legacy.assets.find(
    (asset) => asset.unit.id === mapping.unitId && mapping.previous.includes(asset.contentVersion),
  );
  if (!current || !historical || current.contentVersion !== mapping.contentVersion) {
    throw new Error('Missing paired lesson data for the approved compatibility mapping');
  }
  const previous = readLessonRecordAsset(historical, historical.unit.id, historical.contentVersion);
  const target = current.steps.find((step) => step.assessmentId === questionId);
  const previousQuestion = previous.checkpoints.find(({ id }) => id === questionId);
  const currentQuestion = current.checkpoints.find(({ id }) => id === questionId);
  if (!target || !previousQuestion || !currentQuestion) throw new Error('Missing checkpoint');

  for (const kind of ['guest', 'member'] as const) {
    test(`a ${kind} resumes a compatible answer (${questionId})`, async ({ page }) => {
      await page.goto('/ja/study/fundamentals/');
      await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
      const oldBytes = JSON.stringify(savedGuestSource(previous, questionId, true));
      const newBytes = JSON.stringify(savedGuestSource(current, questionId, false));
      const oldKey = lessonKey(previous);
      const newKey = lessonKey(current);
      let member: RealSession | undefined;
      if (kind === 'guest') {
        await page.getByLabel('ゲストの学習記録をこの端末に保存する').check();
        await page.evaluate(
          (saved) => {
            for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, value);
          },
          { [oldKey]: oldBytes, [newKey]: newBytes },
        );
      } else {
        [member] = await createSessions();
        const initialized = await replayRpc('/rpc/initialize_learning_state', member.accessToken, {});
        expect(await initialized.json()).toBe(0);
        await saveMemberPreparation(member, previous, questionId, true);
        await saveMemberPreparation(member, current, questionId, false);
        await setRealSession(page, member);
      }
      await page.goto(
        lessonPath({
          locale: 'ja',
          unitId: current.unit.id,
          stage: 'checkpoints',
          position: target.position,
        }),
      );
      await expect(page.getByText(label, { exact: true })).toBeVisible();
      const choices = page.locator(`fieldset input[name="${questionId}"]`);
      for (const { id } of currentQuestion.choices) {
        const choice = choices.and(page.locator(`[value="${id}"]`));
        await expect(choice).toBeChecked({ checked: currentQuestion.correct.includes(id) });
      }
      if (member) {
        const saved = await replayRpc('/rpc/load_fundamentals_snapshot', member.accessToken, {
          p_unit_id: current.unit.id,
          p_content_version: current.contentVersion,
          p_expected_generation: 0,
        });
        expect(saved.ok).toBe(true);
        const { progress } = readLessonSnapshot(await saved.json(), current);
        expect(progress.completedCheckpointIds).not.toContain(target.id);
      } else {
        expect(await page.evaluate((key) => localStorage.getItem(key), newKey)).toBe(newBytes);
      }
      await page.getByRole('button', { name: '回答を確認', exact: true }).click();
      await expect(page.locator('.lesson-assessment').getByRole('status')).toHaveText('正解です。');
      await expect(page.getByText(label, { exact: true })).toHaveCount(0);
      if (member) {
        const answers = (await learningEventRows(member))
          .filter(({ question_id }) => question_id === questionId)
          .map((row) => row.selected.join(','));
        expect(answers.sort()).toEqual(
          [previousQuestion, currentQuestion].map(({ correct }) => correct.join(',')).sort(),
        );
      } else {
        expect(await page.evaluate((key) => localStorage.getItem(key), oldKey)).toBe(oldBytes);
      }
    });
  }
}
