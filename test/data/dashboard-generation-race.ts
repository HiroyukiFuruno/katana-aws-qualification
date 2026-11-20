import { randomUUID } from 'node:crypto';
import { query } from '../../scripts/dashboard-fixture';
import type { DashboardEvent } from '../../src/dashboard/eventTypes';
import { createDashboardServices } from '../../src/dashboard/services';
import { readDashboardSummary } from '../../src/dashboard/summaryCodec';
import { createLessonAssets } from '../../src/fundamentals/delivery/assets';
import { createQuestionResolver } from '../../src/progress/questionCatalog';
import { createProgressStore } from '../../src/progress/store';
import type { ProgressRpcClient } from '../../src/progress/types';
import { dashboardRestClient } from './dashboard-settings-recovery';
import type { AuthSession } from './rest-client';

function signal() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export async function verifyDashboardGenerationRace(session: AuthSession, event: DashboardEvent) {
  const control = dashboardRestClient(session);
  const generation = await control.rpc<number>('initialize_learning_state', {});
  await control.rpc('append_learning_event', {
    p_expected_generation: generation,
    p_event: {
      event_id: randomUUID(),
      schema_version: 1,
      certification_id: event.certificationId,
      question_id: event.questionId,
      question_revision: event.questionRevision,
      source_version: event.sourceVersion,
      category: event.category,
      mode: 'study',
      answered_at: event.answeredAt,
      selected: ['C'],
      correct: ['C'],
      is_correct: true,
      duration_ms: 1000,
      attempt_number: 1,
      prior_incorrect_count: 0,
      review_correct: null,
      reward: 1,
    },
  });
  const received = signal();
  const released = signal();
  let hold = true;
  let initializations = 0;
  const client: ProgressRpcClient = {
    ...control,
    async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
      if (name === 'initialize_learning_state') initializations++;
      const response = await control.rpc<T>(name, args);
      // 実DBが返した成功応答の配達だけを遅らせ、resetとの順序を固定する。
      if (name === 'dashboard_summary' && hold) {
        if (readDashboardSummary(response, query).total.answered !== 1)
          throw new Error('Held real response must contain the pre-reset answer');
        hold = false;
        received.resolve();
        await released.promise;
      }
      return response;
    },
  };
  const storage = {
    getItem: (_key: string) => null,
    removeItem: (_key: string) => {},
    setItem: (_key: string, _value: string) => {},
  };
  const owner = { kind: 'member' as const, generation, userId: session.user.id };
  const store = createProgressStore({ client, owner, storage, isCurrent: () => true });
  const services = createDashboardServices({
    store,
    client,
    storage,
    isCurrent: () => true,
    locale: 'en',
    assets: createLessonAssets(),
    resolve: createQuestionResolver(),
  });
  let invalidations = 0;
  const unsubscribe = services.subscribe(() => invalidations++);
  await services.settings();
  const old = services.summary(query);
  try {
    await Promise.race([received.promise, old]);
    await control.rpc('reset_my_learning_data', { p_expected_generation: generation });
    const current = await services.summary(query);
    if (current.summary.total.answered !== 0) throw new Error('Reset summary was not empty');
  } finally {
    released.resolve();
  }
  if ((await old).summary.total.answered !== 0)
    throw new Error('Late old-generation data was accepted after a real reset');
  if (initializations !== 2) throw new Error('Generation recovery initialization was not shared');
  unsubscribe();
  if (invalidations !== 1 || services.getSnapshot() !== 1)
    throw new Error('Previously published widget scopes were not invalidated once');
}
