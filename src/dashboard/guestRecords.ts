import type { Attempt } from '../attempts';
import type { LessonAssets } from '../fundamentals/delivery/assets';
import {
  guestLessonKey,
  guestLessonKeys,
  guestLessonReference,
} from '../fundamentals/state/guestReferences';
import { readGuestLessonSource } from '../fundamentals/state/guestSourceCodec';
import type { GuestLessonSource } from '../fundamentals/state/types';
import { type Locale, localePath } from '../locales';
import { type BrowserStorage, canPersistGuestProgress } from '../progress/guest';
import type { LegacyQuestionResolver } from '../progress/migrationTypes';
import type { DashboardRecords } from './eventTypes';
import { dashboardGuestAttempts } from './guestAttempts';
import { dashboardGuestLesson } from './guestLessonEvents';
import type { DashboardLessonData } from './viewTypes';

type Input = {
  storage: BrowserStorage;
  attempts: Attempt[];
  corruptRows: number;
  resolve: LegacyQuestionResolver;
  assets: LessonAssets;
  locale: Locale;
  isCurrent: () => boolean;
};

export async function loadGuestDashboard(input: Input) {
  const current = () => {
    if (!input.isCurrent() || !canPersistGuestProgress(input.storage))
      throw new Error('Guest dashboard access changed.');
  };
  current();
  const index = await input.assets.index(input.locale);
  current();
  const currentEntries = new Map(index.units.map((entry) => [guestLessonKey(entry), entry]));
  const keys = new Set([...currentEntries.keys(), ...guestLessonKeys(input.storage)]);
  const rawSources = [...keys].map((key) => ({
    entry: currentEntries.get(key),
    reference: guestLessonReference(key),
    raw: input.storage.getItem(key),
  }));
  const normal = await dashboardGuestAttempts(input.attempts, input.resolve);
  current();
  const records: DashboardRecords = {
    ...normal,
    lessonFinals: [],
    excludedRecords: normal.excludedRecords + input.corruptRows,
  };
  const lessons: DashboardLessonData[] = [];
  for (const { entry, reference, raw } of rawSources) {
    current();
    const common = entry && {
      unitId: entry.unitId,
      title: entry.title,
      href: localePath(input.locale, `study/fundamentals/${entry.slug}`),
    };
    if (raw === null) {
      if (!entry || !common) continue;
      lessons.push({
        ...common,
        summary: {
          unitId: entry.unitId,
          contentVersion: entry.contentVersion,
          completedSlides: 0,
          totalSlides: entry.totalSteps - entry.checkpointCount - entry.finalQuestionCount,
          completedCheckpoints: 0,
          totalCheckpoints: entry.checkpointCount,
          activeFinalSessionId: null,
          passedAt: null,
          latestScore: null,
          requiredScore: null,
        },
      });
      continue;
    }
    const asset =
      reference &&
      (await input.assets.record(
        reference.unitId,
        reference.contentVersion,
        input.locale,
        input.storage,
      ));
    current();
    if (!asset) {
      records.excludedRecords++;
      continue;
    }
    let source: GuestLessonSource;
    try {
      source = readGuestLessonSource(JSON.parse(raw), asset);
    } catch {
      records.excludedRecords++;
      continue;
    }
    const derived = dashboardGuestLesson(source, asset);
    records.events.push(...derived.events);
    records.lessonFinals.push(...derived.lessonFinals);
    if (common) lessons.push({ ...common, summary: derived.summary });
  }
  current();
  if (new Set(records.events.map((event) => event.eventId)).size !== records.events.length)
    throw new Error('Guest dashboard contains conflicting event identities.');
  return { records, lessons };
}
