import type { Locale } from '../../locales';
import type { DeliveryIndexAsset } from './artifactTypes';
import { loadDeliveryIndex } from './loadIndex';

export const archivedLessonEditions = ['2026-11-20'] as const;

export type LessonEdition = { index: DeliveryIndexAsset; basePath: string; publishedOn?: string };

export async function loadArchivedLessonEditions(locale?: Locale): Promise<LessonEdition[]> {
  return Promise.all(
    archivedLessonEditions.map(async (edition) => {
      const basePath = `/fundamentals/delivery/history/${edition}`;
      return {
        index: await loadDeliveryIndex({ basePath, locale }),
        basePath,
        publishedOn: edition,
      };
    }),
  );
}
