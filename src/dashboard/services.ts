import type { LessonAssets } from '../fundamentals/delivery/assets';
import type { Locale } from '../locales';
import { ProgressApiError } from '../progress/api';
import type { BrowserStorage } from '../progress/guest';
import type { LegacyQuestionResolver } from '../progress/migrationTypes';
import type { ProgressStore } from '../progress/storeTypes';
import type { ProgressRpcClient } from '../progress/types';
import { aggregateDashboard } from './aggregate';
import { loadGuestDashboard } from './guestRecords';
import { createGuestDashboardSettings } from './guestSettings';
import { createMemberDashboard } from './memberRepository';
import { dashboardLessonSyncStatus } from './pending';

type Input = {
  store: ProgressStore;
  client: ProgressRpcClient | null;
  isCurrent: () => boolean;
  storage: BrowserStorage;
  assets: LessonAssets;
  resolve: LegacyQuestionResolver;
  locale: Locale;
};

export function createDashboardServices(input: Input) {
  if (input.store.getSnapshot().owner.kind === 'member') {
    if (!input.client) throw new Error('Member dashboard access is missing.');
    const repository = createMemberDashboard(input.client, input.isCurrent);
    let initialized: Promise<number> | undefined;
    const ready = () => {
      if (!initialized) {
        const attempt = repository.initialize();
        initialized = attempt;
        void attempt.catch(() => {
          if (initialized === attempt) initialized = undefined;
        });
      }
      return initialized;
    };
    const read = async <T>(operation: () => Promise<T>): Promise<T> => {
      await ready();
      try {
        return await operation();
      } catch (error) {
        if (!(error instanceof ProgressApiError) || error.code !== 'PT409') throw error;
        initialized = undefined;
        await ready();
        return operation();
      }
    };
    return {
      async syncStatus() {
        const generation = await ready();
        if (!input.isCurrent()) throw new Error('Dashboard owner changed.');
        const owner = input.store.getSnapshot().owner;
        if (owner.kind !== 'member') throw new Error('Member dashboard owner changed.');
        const result = dashboardLessonSyncStatus(input.storage, owner.userId, generation);
        if (!input.isCurrent()) throw new Error('Dashboard owner changed.');
        return result;
      },
      async settings() {
        return read(repository.settings);
      },
      async save(...args: Parameters<typeof repository.save>) {
        await ready();
        return repository.save(...args);
      },
      async summary(...args: Parameters<typeof repository.summary>) {
        return { summary: await read(() => repository.summary(...args)), excludedRecords: 0 };
      },
      async lessons() {
        return read(() => repository.lessons(input.assets, input.locale));
      },
    };
  }
  const settings = createGuestDashboardSettings(input.storage, input.isCurrent);
  let guest: ReturnType<typeof loadGuestDashboard> | undefined;
  const records = () => {
    if (!guest) {
      const snapshot = input.store.getSnapshot();
      const attempt = loadGuestDashboard({
        ...input,
        attempts: structuredClone(snapshot.attempts),
        corruptRows: snapshot.corruptRows,
      });
      guest = attempt;
      void attempt.catch(() => {
        if (guest === attempt) guest = undefined;
      });
    }
    return guest;
  };
  return {
    async syncStatus() {
      return { pending: false, unreadable: false };
    },
    async settings() {
      return settings.load();
    },
    save: settings.save,
    async summary(query: Parameters<typeof aggregateDashboard>[1]) {
      const { records: source } = await records();
      return { summary: aggregateDashboard(source, query), excludedRecords: source.excludedRecords };
    },
    async lessons() {
      return (await records()).lessons;
    },
  };
}

export type DashboardServices = ReturnType<typeof createDashboardServices>;
