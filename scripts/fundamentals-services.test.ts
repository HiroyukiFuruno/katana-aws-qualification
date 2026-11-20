import { expect, test } from 'bun:test';
import indexData from '../public/fundamentals/delivery/index.json' with { type: 'json' };
import { parseDeliveryIndex } from '../src/fundamentals/delivery/loadIndex';
import { createLessonServices } from '../src/fundamentals/state/services';
import { emptyLessonSnapshot, lessonAsset } from './fundamentals-state-fixture';
import { memoryStorage } from './memory-storage.fixture';

test('a member read after another tab resets data refreshes server generation before explicit retry', async () => {
  let generation = 0;
  const received: number[] = [];
  const client = {
    rpc: async <T>(name: string, args: Record<string, unknown>) => {
      if (name === 'initialize_learning_state') return generation as T;
      if (name !== 'load_fundamentals_snapshot') throw new Error('Unexpected fixture operation.');
      received.push(Number(args.p_expected_generation));
      if (args.p_expected_generation !== generation) throw { code: 'PT409' };
      return emptyLessonSnapshot() as T;
    },
    select: async <T>() => [] as T,
  };
  const services = createLessonServices({
    assets: { index: async () => parseDeliveryIndex(indexData), unit: async () => lessonAsset },
    storage: memoryStorage(),
    isCurrent: () => true,
    member: { client, userId: '10000000-0000-4000-8000-000000000001' },
  });
  await services.load(lessonAsset);
  generation = 1;
  await expect(services.load(lessonAsset)).rejects.toMatchObject({ code: 'PT409' });
  await expect(services.load(lessonAsset)).resolves.toEqual(emptyLessonSnapshot());
  expect(received).toEqual([0, 0, 1]);
});
