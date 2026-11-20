import { expect, test } from '@playwright/test';
import { lessonOutboxKey } from '../../src/fundamentals/state/outboxCodec';
import type { LessonCommand } from '../../src/fundamentals/state/outboxTypes';
import { readLessonSnapshot } from '../../src/fundamentals/state/snapshotCodec';
import { replayRpc } from './api';
import { archivedAsset } from './fundamentals-edition.fixture';
import { lessonAssets } from './fundamentals.helpers';
import { createSessions } from './sessions';
import { fixtureKey, gatewayOrigin } from './settings';

test('a durable archived command replays against its original catalog and only its owner', async ({
  page,
}) => {
  const [a, b] = await createSessions();
  const step = archivedAsset.steps[0];
  const revised = lessonAssets[0];
  if (!step || !revised) throw new Error('Missing edition fixtures');
  expect(revised.contentVersion).not.toBe(archivedAsset.contentVersion);
  const command: LessonCommand = {
    commandId: crypto.randomUUID(),
    unitId: archivedAsset.unit.id,
    contentVersion: archivedAsset.contentVersion,
    kind: 'recordStep',
    input: { stepId: step.id, expectedRevision: 0, receiptId: crypto.randomUUID(), durationMs: 20 },
  };
  const key = lessonOutboxKey(a.userId);
  const raw = JSON.stringify({ commands: [command], generation: 0, userId: a.userId, version: 1 });
  await page.goto('/ja/study/fundamentals/');
  await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
  const execute = async (session: typeof a) =>
    page.evaluate(
      async ({ session, url, key }) => {
        const assetPath = '/src/fundamentals/delivery/assets.ts';
        const servicePath = '/src/fundamentals/state/services.ts';
        const apiPath = '/src/progress/api.ts';
        const { createLessonAssets } = (await import(
          assetPath
        )) as typeof import('../../src/fundamentals/delivery/assets');
        const { createLessonServices } = (await import(
          servicePath
        )) as typeof import('../../src/fundamentals/state/services');
        const { createProgressApi } = (await import(apiPath)) as typeof import('../../src/progress/api');
        const services = createLessonServices({
          assets: createLessonAssets(),
          storage: localStorage,
          isCurrent: () => true,
          member: {
            userId: session.userId,
            client: createProgressApi(
              { url, key },
              async () => session.accessToken,
              () => true,
            ),
          },
        });
        if (!services.outbox) throw new Error('Missing real member outbox');
        await services.outbox.initialize();
        const pending = services.outbox.hasPending();
        await services.outbox.flush();
        services.dispose();
        return pending;
      },
      { session, url: gatewayOrigin, key: fixtureKey('anon') },
    );
  expect(await execute(b)).toBe(false);
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(raw);
  expect(await execute(a)).toBe(true);
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
  for (const session of [a, b]) {
    for (const asset of [archivedAsset, revised]) {
      const response = await replayRpc('/rpc/load_fundamentals_snapshot', session.accessToken, {
        p_unit_id: asset.unit.id,
        p_content_version: asset.contentVersion,
        p_expected_generation: 0,
      });
      const snapshot = readLessonSnapshot(await response.json(), asset);
      const expected = session.userId === a.userId && asset === archivedAsset ? 1 : 0;
      expect(snapshot.progress.furthestPlanPosition).toBe(expected);
      expect(snapshot.sessions).toHaveLength(0);
    }
  }
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
  expect(await execute(a)).toBe(true);
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
  const response = await replayRpc('/rpc/load_fundamentals_snapshot', a.accessToken, {
    p_unit_id: archivedAsset.unit.id,
    p_content_version: archivedAsset.contentVersion,
    p_expected_generation: 0,
  });
  expect(readLessonSnapshot(await response.json(), archivedAsset).progress.revision).toBe(1);
});
