import type { DeliveryIndexAsset } from './artifactTypes';
import { fetchDeliveryJson, parseDeliveryIndex } from './loadIndex';

export const archivedLessonEditions = ['2026-11-20'] as const;

export type LessonEdition = { index: DeliveryIndexAsset; basePath: string };

export async function loadArchivedLessonEditions(): Promise<LessonEdition[]> {
  return Promise.all(
    archivedLessonEditions.map(async (edition) => {
      const basePath = `/fundamentals/delivery/history/${edition}`;
      return { index: parseDeliveryIndex(await fetchDeliveryJson(`${basePath}/index.json`)), basePath };
    }),
  );
}
